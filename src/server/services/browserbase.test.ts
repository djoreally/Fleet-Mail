import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithBrowserbase } from './browserbase.js';

const originalBrowserbaseKey = process.env.BROWSERBASE_API_KEY;
const originalFirecrawlKey = process.env.FIRECRAWL_API_KEY;

beforeEach(() => {
  delete process.env.BROWSERBASE_API_KEY;
  delete process.env.FIRECRAWL_API_KEY;
});

afterEach(() => {
  if (originalBrowserbaseKey === undefined) delete process.env.BROWSERBASE_API_KEY;
  else process.env.BROWSERBASE_API_KEY = originalBrowserbaseKey;
  if (originalFirecrawlKey === undefined) delete process.env.FIRECRAWL_API_KEY;
  else process.env.FIRECRAWL_API_KEY = originalFirecrawlKey;
  vi.restoreAllMocks();
});

describe('Browserbase compatibility path', () => {
  it('requires at least one configured web provider', async () => {
    await expect(fetchWithBrowserbase('https://example.com')).rejects.toThrow(/not configured/);
  });

  it('uses Firecrawl only as a compatibility fallback when Browserbase is unavailable', async () => {
    process.env.FIRECRAWL_API_KEY = 'fc_test_secret';
    const crawler = vi.fn().mockResolvedValue({
      sourceUrl: 'https://example.com/',
      pages: [{ url: 'https://example.com/', title: 'Example', content: 'Fallback research content' }],
    });
    const page = await fetchWithBrowserbase('https://example.com', async raw => new URL(raw), crawler);
    expect(page.provider).toBe('firecrawl');
    expect(page.content).toContain('Fallback research content');
    expect(crawler).toHaveBeenCalledOnce();
  });
});
