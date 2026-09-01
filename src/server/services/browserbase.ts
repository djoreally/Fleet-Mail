import { crawlWebsite, validatePublicUrl } from './firecrawl.js';

const API_URL = 'https://api.browserbase.com/v1/fetch';

export interface BrowserbasePage {
  sourceUrl: string;
  requestId: string;
  statusCode: number;
  contentType: string;
  content: string;
  provider?: 'firecrawl' | 'browserbase';
}

/**
 * Explicit Browserbase access. This is intentionally NOT a research fallback.
 * Use it only for a user-requested browser interaction or a browser-only workflow.
 */
export async function fetchWithBrowserbaseDirect(rawUrl: string, urlValidator: typeof validatePublicUrl = validatePublicUrl): Promise<BrowserbasePage> {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) throw new Error('Browser access is not configured yet. Add BROWSERBASE_API_KEY to the production environment.');
  const url = await urlValidator(rawUrl);
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-BB-API-Key': apiKey },
    body: JSON.stringify({
      url: url.href,
      allowRedirects: true,
      allowInsecureSsl: false,
      proxies: false,
      format: 'markdown',
    }),
    signal: AbortSignal.timeout(25_000),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(body.message || body.error || `Browserbase request failed (${response.status}).`));
  const content = typeof body.content === 'string' ? body.content.slice(0, 24_000) : '';
  if (!content.trim()) throw new Error('Browserbase loaded the page, but no readable content was returned.');
  return {
    sourceUrl: url.href,
    requestId: String(body.id || ''),
    statusCode: Number(body.statusCode || 200),
    contentType: String(body.contentType || 'text/markdown'),
    content,
    provider: 'browserbase',
  };
}

/**
 * Legacy-named compatibility entry point used by the current chat research route.
 * Despite the historical name, this path is Firecrawl-only. Browserbase must never
 * silently substitute for information gathering; explicit browser tasks use
 * fetchWithBrowserbaseDirect or the interactive browser-action service.
 */
export async function fetchWithBrowserbase(
  rawUrl: string,
  _urlValidator: typeof validatePublicUrl = validatePublicUrl,
  crawler: typeof crawlWebsite = crawlWebsite,
): Promise<BrowserbasePage> {
  if (!process.env.FIRECRAWL_API_KEY?.trim()) {
    throw new Error('Website research is not configured. Add FIRECRAWL_API_KEY; Browserbase is reserved for explicit browser actions.');
  }
  const result = await crawler(rawUrl);
  const content = result.pages
    .map((page) => `${page.title}\n${page.url}\n${page.content}`)
    .join('\n\n')
    .slice(0, 24_000);
  if (!content.trim()) throw new Error('Firecrawl completed, but no readable content was returned.');
  return {
    sourceUrl: result.sourceUrl,
    requestId: 'firecrawl-research',
    statusCode: 200,
    contentType: 'text/markdown',
    content,
    provider: 'firecrawl',
  };
}
