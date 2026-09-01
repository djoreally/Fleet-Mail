import { validatePublicUrl } from './firecrawl.js';

const API_URL = 'https://api.browserbase.com/v1/fetch';

export interface BrowserbasePage {
  sourceUrl: string;
  requestId: string;
  statusCode: number;
  contentType: string;
  content: string;
}

export async function fetchWithBrowserbase(rawUrl: string, urlValidator: typeof validatePublicUrl = validatePublicUrl): Promise<BrowserbasePage> {
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
  };
}
