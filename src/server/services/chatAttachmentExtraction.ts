import type { NextFunction, Request, Response } from 'express';
import { DocumentExtractionError, extractDocumentText, supportedBinaryDocumentTypes } from './documentTextExtraction.js';
import { extractImageTextAndEntities, formatImageScanForAgent } from './imageOcr.js';

const MAX_ATTACHMENTS = 4;
const MAX_TOTAL_BYTES = 3_000_000;

function estimatedDataUrlBytes(value: unknown) {
  const match = String(value || '').match(/^data:[^;,]+;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return 0;
  return Math.floor(match[1].length * 3 / 4) - (match[1].endsWith('==') ? 2 : match[1].endsWith('=') ? 1 : 0);
}

export async function chatAttachmentExtractionMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'POST') return next();
  const rawAttachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
  if (rawAttachments.length > MAX_ATTACHMENTS) return res.status(413).json({ error: `A maximum of ${MAX_ATTACHMENTS} attachments is allowed` });
  if (!rawAttachments.length) return next();

  const totalBytes = rawAttachments.reduce((sum, raw) => {
    const file = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const declared = Number(file.size || 0);
    return sum + Math.max(Number.isFinite(declared) ? declared : 0, estimatedDataUrlBytes(file.dataUrl));
  }, 0);
  if (totalBytes > MAX_TOTAL_BYTES) return res.status(413).json({ error: 'Attachments exceed the 3 MB total limit' });

  try {
    const normalized = [];
    for (const raw of rawAttachments) {
      const file = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
      const type = String(file.type || '').toLowerCase();
      const dataUrl = String(file.dataUrl || '');
      if (file.kind === 'image' && dataUrl) {
        try {
          const scan = await extractImageTextAndEntities(dataUrl, String(file.name || 'camera-scan.jpg'));
          normalized.push({ ...file, text: formatImageScanForAgent(scan), ocr: scan, extracted: true });
        } catch (error) {
          normalized.push({ ...file, text: '', extracted: false, extractionError: error instanceof Error ? error.message : 'OCR failed' });
        }
      } else if (file.kind === 'document' && supportedBinaryDocumentTypes.has(type) && !String(file.text || '').trim()) {
        try {
          const extracted = await extractDocumentText(file);
          normalized.push({ ...file, text: extracted.text, dataUrl: undefined, extracted: true });
        } catch (error) {
          if (error instanceof DocumentExtractionError && error.status === 422) {
            normalized.push({ ...file, text: '', dataUrl: undefined, extracted: false, extractionError: error.message });
          } else {
            throw error;
          }
        }
      } else {
        normalized.push(file);
      }
    }
    req.body.attachments = normalized;
    return next();
  } catch (error) {
    const status = error instanceof DocumentExtractionError ? error.status : 422;
    return res.status(status).json({ error: error instanceof Error ? error.message : 'Attachment extraction failed' });
  }
}
