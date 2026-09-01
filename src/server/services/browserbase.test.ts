import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithBrowserbase, fetchWithBrowserbaseDirect } from './browserbase.js';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BROWSERBASE_API_KEY;
  delete process.env.FIRECRAWL_API_KEY;
});

describe('web research routing', () => {
  it('requires a configured research or browser provider', async () => {
    await expect(fetchWithBrowserbase('https://example.com')).rejects.toThrow(/not configured/);
  });

  it('uses Firecrawl as the primary information-gathering tool', async () => {
    process.env.FIRECRAWL_API_KEY = 'fc_test_secret';
    process.env.BROWSERBASE_API_KEY = 'bb_test_secret';
    const crawler = vi.fn().mockResolvedValue({
      sourceUrl: 'https://example.com/',
      pages: [{ url: 'https://example.com/', title: 'Example', content: 'Firecrawl content' }],
    });
    const page = await fetchWithBrowserbase('https://example.com', async raw => new URL(raw), crawler);
    expect(page.provider).toBe('firecrawl');
    expect(page.content).toContain('Firecrawl content');
    expect(crawler).toHaveBeenCalledOnce();
  });

  it('keeps direct Browserbase access available for explicit browser tasks', async () => {
    process.env.BROWSERBASE_API_KEY = 'bb_test_secret';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'fetch-1', statusCode: 200, contentType: 'text/markdown', content: '# Example\nBrowser content' }),
    }));
    const page = await fetchWithBrowserbaseDirect('https://example.com', async raw => new URL(raw));
    expect(page.provider).toBe('browserbase');
    expect(page.content).toContain('Browser content');
    const [, request] = vi.mocked(fetch).mock.calls[0];
    expect((request?.headers as Record<string, string>)['X-BB-API-Key']).toBe('bb_test_secret');
    expect(JSON.stringify(request?.body)).not.toContain('bb_test_secret');
  });
});
