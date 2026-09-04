import { callAICompletion } from './ai.js';

export type ImageScanKind = 'document' | 'business_card' | 'vehicle' | 'other';
export type ImageScanResult = {
  kind: ImageScanKind;
  rawText: string;
  fields: Record<string, string | number | boolean | null | string[]>;
  confidence: number;
};

function safeJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(cleaned); } catch { return null; }
}

export async function extractImageTextAndEntities(dataUrl: string, filename = 'camera-scan.jpg'): Promise<ImageScanResult> {
  if (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(dataUrl)) throw new Error('OCR requires a PNG, JPEG, or WebP image');
  const prompt = `Perform OCR and structured extraction on this image. It may be a business card, document, or company/fleet vehicle photo.
Return ONLY JSON with this exact shape:
{"kind":"document|business_card|vehicle|other","rawText":"all legible text exactly as seen","fields":{},"confidence":0}
For business cards, fields may include name,title,company,email,phone,website,address.
For vehicles, fields may include companyName,unitNumber,dotNumber,licensePlate,vin,phone,website,vehicleMake,vehicleModel and visibleBranding. Never invent unreadable values.
For documents, fields may include documentType,date,company,contact,invoiceNumber,total,address,phone,email and other clearly labeled values.
confidence is an integer 0-100. Filename: ${filename}`;
  const result = await callAICompletion([
    { role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] },
  ], 'You are Fleet OS OCR. Transcribe visible text faithfully and extract only visually supported fields. Output strict JSON only.');
  const parsed = safeJson(result.content) || {};
  const kind = ['document','business_card','vehicle','other'].includes(parsed.kind) ? parsed.kind as ImageScanKind : 'other';
  const rawText = String(parsed.rawText || '').slice(0, 20_000);
  const fields = parsed.fields && typeof parsed.fields === 'object' && !Array.isArray(parsed.fields) ? parsed.fields as Record<string, string | number | boolean | null | string[]> : {};
  const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0)));
  return { kind, rawText, fields, confidence };
}

export function formatImageScanForAgent(scan: ImageScanResult) {
  const fieldText = Object.entries(scan.fields).filter(([, value]) => value !== null && value !== '' && !(Array.isArray(value) && !value.length)).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`).join('\n');
  return [`OCR classification: ${scan.kind}`, `OCR confidence: ${scan.confidence}%`, scan.rawText ? `Visible text:\n${scan.rawText}` : '', fieldText ? `Extracted fields:\n${fieldText}` : ''].filter(Boolean).join('\n\n');
}
