import type { NextFunction, Request, Response } from 'express';
import { DocumentExtractionError, extractDocumentText, supportedBinaryDocumentTypes } from './documentTextExtraction.js';

export async function chatAttachmentExtractionMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'POST') return next();
  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments.slice(0, 4) : [];
  if (!attachments.length) return next();

  try {
    const normalized = [];
    for (const raw of attachments) {
      const file = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
      const type = String(file.type || '').toLowerCase();
      if (file.kind === 'document' && supportedBinaryDocumentTypes.has(type) && !String(file.text || '').trim()) {
        const extracted = await extractDocumentText(file);
        normalized.push({ ...file, text: extracted.text, dataUrl: undefined, extracted: true });
      } else {
        normalized.push(file);
      }
    }
    req.body.attachments = normalized;
    return next();
  } catch (error) {
    const status = error instanceof DocumentExtractionError ? error.status : 422;
    return res.status(status).json({ error: error instanceof Error ? error.message : 'Document extraction failed' });
  }
}
