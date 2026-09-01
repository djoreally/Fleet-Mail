import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithBrowserbase } from './browserbase.js';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BROWSERBASE_API_KEY;
});

describe('Browserbase page access', () => {
  it('requires server-side configuration', async () => {
    await expect(fetchWithBrowserbase('https://example.com')).rejects.toThrow(/not configured/);
  });

  it('returns grounded markdown without exposing the key', async () => {
    process.env.BROWSERBASE_API_KEY = 'bb_test_secret';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'fetch-1', statusCode: 200, contentType: 'text/markdown', content: '# Example\nBrowser content' }),
    }));
    const page = await fetchWithBrowserbase('https://example.com', async raw => new URL(raw));
    expect(page.content).toContain('Browser content');
    const [, request] = vi.mocked(fetch).mock.calls[0];
    expect((request?.headers as Record<string, string>)['X-BB-API-Key']).toBe('bb_test_secret');
    expect(JSON.stringify(request?.body)).not.toContain('bb_test_secret');
  });
});
