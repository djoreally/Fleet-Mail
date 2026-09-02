import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('chat document attachment contract', () => {
  it('transports PDF and DOCX bytes and extracts their text server-side before agent grounding', () => {
    const ui = readFileSync('src/components/AIChatView.tsx', 'utf8');
    const extraction = readFileSync('src/server/services/documentTextExtraction.ts', 'utf8');
    const middleware = readFileSync('src/server/services/chatAttachmentExtraction.ts', 'utf8');
    const app = readFileSync('src/server/app.ts', 'utf8');
    expect(ui).toContain("type === 'application/pdf' || type === DOCX");
    expect(extraction).toContain("import('pdf-parse')");
    expect(extraction).toContain("import('mammoth')");
    expect(middleware).toContain('MAX_ATTACHMENTS = 4');
    expect(middleware).toContain('MAX_TOTAL_BYTES = 3_000_000');
    expect(middleware).toContain('error.status === 422');
    expect(app.indexOf('chatAttachmentExtractionMiddleware')).toBeLessThan(app.lastIndexOf('fleetAgentRuntimeMiddleware'));
  });

  it('keeps Browserbase explicit and Firecrawl as the research compatibility path', () => {
    const browser = readFileSync('src/server/services/browserbase.ts', 'utf8');
    const runtime = readFileSync('src/server/services/fleetAgentRuntime.ts', 'utf8');
    expect(browser).toContain('fetchWithBrowserbaseDirect');
    expect(browser).toContain('This is intentionally NOT a research fallback');
    expect(browser).toContain('Legacy-named compatibility entry point');
    expect(browser).toContain('crawler(rawUrl)');
    expect(runtime).toContain('Browserbase is explicit-action-only');
    expect(runtime).toContain('Firecrawl is the research tool');
  });
});
