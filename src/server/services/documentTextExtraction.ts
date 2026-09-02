const PDF_TYPE = 'application/pdf';
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export class DocumentExtractionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function decodeDataUrl(dataUrl: unknown, expectedType: string, maxBytes = 3_000_000) {
  const value = String(dataUrl || '');
  const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[1].toLowerCase() !== expectedType.toLowerCase()) throw new DocumentExtractionError(400, 'Attachment binary data is invalid');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > maxBytes) throw new DocumentExtractionError(413, 'Attachment binary data is too large');
  return buffer;
}

export async function extractDocumentText(input: { name?: unknown; type?: unknown; dataUrl?: unknown; text?: unknown }) {
  const name = String(input.name || 'document').slice(0, 180);
  const type = String(input.type || '').toLowerCase();
  if (typeof input.text === 'string' && input.text.trim()) return { name, type, text: input.text.slice(0, 50_000), extracted: false };

  if (type === PDF_TYPE) {
    const buffer = decodeDataUrl(input.dataUrl, PDF_TYPE);
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      const text = String(result.text || '').trim().slice(0, 50_000);
      if (!text) throw new DocumentExtractionError(422, 'No readable text was found in the PDF');
      return { name, type, text, extracted: true };
    } finally {
      await parser.destroy();
    }
  }

  if (type === DOCX_TYPE) {
    const buffer = decodeDataUrl(input.dataUrl, DOCX_TYPE);
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const text = String(result.value || '').trim().slice(0, 50_000);
    if (!text) throw new DocumentExtractionError(422, 'No readable text was found in the DOCX file');
    return { name, type, text, extracted: true };
  }

  return { name, type, text: '', extracted: false };
}

export const supportedBinaryDocumentTypes = new Set([PDF_TYPE, DOCX_TYPE]);
