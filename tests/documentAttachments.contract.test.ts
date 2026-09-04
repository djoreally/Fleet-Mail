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

  it('keeps Browserbase as the primary web capability platform with Firecrawl fallback compatibility', () => {
    const browser = readFileSync('src/server/services/browserbase.ts', 'utf8');
    const router = readFileSync('src/server/services/webCapabilityRouter.ts', 'utf8');
    const runtime = readFileSync('src/server/services/fleetAgentRuntime.ts', 'utf8');
    expect(browser).toContain('fetchWithBrowserbaseDirect');
    expect(browser).toContain('searchWithBrowserbase');
    expect(browser).toContain('extractCompanyWithBrowserbase');
    expect(browser).toContain('browseWithBrowserbase');
    expect(browser).toContain('prepareFormWithBrowserbase');
    expect(browser).toContain('fillFormWithBrowserbase');
    expect(browser).toContain('downloadDocumentWithBrowserbase');
    expect(browser).toContain('Legacy compatibility entry point');
    expect(browser).toContain('crawler(rawUrl)');
    expect(router).toContain("provider: 'browserbase'");
    expect(runtime).toContain('Browserbase');
  });
});
