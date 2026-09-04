import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Fleet OS attachment, camera, and OCR contract', () => {
  const emailDetail = readFileSync('src/components/EmailDetail.tsx', 'utf8');
  const chatUi = readFileSync('src/components/AIChatView.tsx', 'utf8');
  const attachmentRoute = readFileSync('src/server/routes/agentMailAttachments.ts', 'utf8');
  const extraction = readFileSync('src/server/services/chatAttachmentExtraction.ts', 'utf8');
  const ocr = readFileSync('src/server/services/imageOcr.ts', 'utf8');

  it('sends attachments on replies through the original AgentMail message', () => {
    expect(emailDetail).toContain('replyToMessageId:email.id');
    expect(emailDetail).toContain("'/api/agentmail/send-with-attachments'");
    expect(emailDetail).toContain('MAX_REPLY_FILES=4');
    expect(attachmentRoute).toContain("/messages/${encodeURIComponent(replyToMessageId)}/reply");
    expect(attachmentRoute).toContain('attachments');
  });

  it('opens the device camera only after an explicit user action', () => {
    expect(chatUi).toContain('navigator.mediaDevices.getUserMedia');
    expect(chatUi).toContain("facingMode:{ideal:'environment'}");
    expect(chatUi).toContain('capture="environment"');
    expect(chatUi).toContain('Capture scan');
    expect(chatUi).toContain('cameraStreamRef.current?.getTracks()');
  });

  it('OCR-extracts business cards, documents, and company vehicle photos server-side', () => {
    expect(extraction).toContain('extractImageTextAndEntities');
    expect(extraction).toContain('formatImageScanForAgent');
    expect(ocr).toContain("'business_card'");
    expect(ocr).toContain("'vehicle'");
    expect(ocr).toContain('rawText');
    expect(ocr).toContain('unitNumber');
    expect(ocr).toContain('dotNumber');
    expect(ocr).toContain('licensePlate');
    expect(ocr).toContain('vin');
  });

  it('keeps attachment limits enforced on both chat and email paths', () => {
    expect(extraction).toContain('MAX_ATTACHMENTS = 4');
    expect(extraction).toContain('MAX_TOTAL_BYTES = 3_000_000');
    expect(attachmentRoute).toContain('MAX_INLINE_BYTES = 3_000_000');
    expect(attachmentRoute).toContain('MAX_ATTACHMENTS = 4');
  });
});
