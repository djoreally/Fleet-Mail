import Browserbase from '@browserbasehq/sdk';
import { browserbase, Stagehand } from '@browserbasehq/stagehand';
import AdmZip from 'adm-zip';
import { z } from 'zod/v4';
import { crawlWebsite, validatePublicUrl } from './firecrawl.js';

export interface BrowserbasePage {
  sourceUrl: string;
  requestId: string;
  statusCode: number;
  contentType: string;
  content: string;
  provider?: 'firecrawl' | 'browserbase';
}

export interface BrowserbaseSearchResult {
  title: string;
  url: string;
  snippet: string;
  author?: string;
  publishedDate?: string;
}

export interface BrowserbaseGeo {
  city: string;
  country: string;
  state?: string;
}

export interface BrowserbaseSessionResult<T = unknown> {
  sourceUrl: string;
  sessionId: string;
  data: T;
  cacheStatus?: string;
}

const CompanySchema = z.object({
  name: z.string().default(''),
  summary: z.string().default(''),
  valueProposition: z.string().default(''),
  services: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  emails: z.array(z.string()).default([]),
  phones: z.array(z.string()).default([]),
  fleetSignals: z.array(z.string()).default([]),
});

const PageSchema = z.object({
  title: z.string().default(''),
  summary: z.string().default(''),
  links: z.array(z.object({ label: z.string().default(''), url: z.string().default('') })).default([]),
});

function apiKey() {
  const value = process.env.BROWSERBASE_API_KEY?.trim();
  if (!value) throw new Error('Browser access is not configured.');
  return value;
}

function client() {
  return new Browserbase({ apiKey: apiKey() });
}

function proxyConfig(geo?: BrowserbaseGeo) {
  if (!geo) return undefined;
  return [{
    type: 'browserbase' as const,
    geolocation: {
      city: geo.city,
      country: geo.country,
      ...(geo.state ? { state: geo.state } : {}),
    },
  }];
}

async function withStagehand<T>(
  rawUrl: string,
  operation: (stagehand: Stagehand, page: any, sessionId: string, sourceUrl: string) => Promise<T>,
  geo?: BrowserbaseGeo,
): Promise<T> {
  const url = await validatePublicUrl(rawUrl);
  const browser = await browserbase.launch({
    apiKey: apiKey(),
    proxies: proxyConfig(geo),
    browserSettings: { advancedStealth: true, blockAds: true, solveCaptchas: true },
  });
  const sessionId = String(browser.sessionId || '');
  const stagehand = await Stagehand.create({
    browser,
    cache: { threshold: 1 },
    logging: { level: 'error' },
  });
  try {
    const page = (await browser.context.pages())[0];
    if (!page) throw new Error('Browserbase session did not provide an active page.');
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    return await operation(stagehand, page, sessionId, url.href);
  } finally {
    await stagehand.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

/**
 * Browserbase Search has no SDK method yet. Use the documented direct HTTP API.
 * Search returns discovery metadata only; Fetch/Stagehand are used for page content.
 */
export async function searchWithBrowserbase(query: string, limit = 8): Promise<BrowserbaseSearchResult[]> {
  const cleaned = String(query || '').trim().slice(0, 500);
  if (!cleaned) throw new Error('A web search query is required.');
  const response = await fetch('https://api.browserbase.com/v1/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-BB-API-Key': apiKey(),
    },
    body: JSON.stringify({ query: cleaned, numResults: Math.max(1, Math.min(limit, 25)) }),
  });
  if (!response.ok) {
    throw new Error(`Browserbase Search failed with HTTP ${response.status}.`);
  }
  const data = await response.json() as { results?: Array<Record<string, unknown>> };
  return (data.results || []).map((result) => ({
    title: String(result.title || ''),
    url: String(result.url || ''),
    snippet: String(result.description || result.snippet || ''),
    author: result.author ? String(result.author) : undefined,
    publishedDate: result.publishedDate ? String(result.publishedDate) : undefined,
  })).filter((result) => result.url);
}

/** Lightweight Browserbase Fetch API path for static/non-JS pages. */
export async function fetchWithBrowserbaseDirect(
  rawUrl: string,
  urlValidator: typeof validatePublicUrl = validatePublicUrl,
): Promise<BrowserbasePage> {
  const url = await urlValidator(rawUrl);
  const data = await client().fetchAPI.create({ url: url.href, allowRedirects: true });
  const statusCode = Number((data as any).statusCode || 0);
  if (statusCode >= 400) throw new Error(`Browserbase Fetch failed with HTTP ${statusCode}.`);
  const content = typeof data.content === 'string' ? data.content.slice(0, 24_000) : JSON.stringify(data.content).slice(0, 24_000);
  if (!content.trim()) throw new Error('Browserbase Fetch returned no readable content; use a browser session for JavaScript-rendered content.');
  return {
    sourceUrl: url.href,
    requestId: String((data as any).id || ''),
    statusCode: statusCode || 200,
    contentType: String((data as any).contentType || 'text/html'),
    content,
    provider: 'browserbase',
  };
}

export async function extractCompanyWithBrowserbase(rawUrl: string, geo?: BrowserbaseGeo) {
  return withStagehand(rawUrl, async (stagehand, _page, sessionId, sourceUrl) => {
    const result = await stagehand.extract(
      'Extract the company name, concise summary, core value proposition, services, physical/service locations, public emails, public phone numbers, and concrete signals that the company operates vehicles or could need fleet maintenance. Use empty arrays when unavailable.',
      CompanySchema,
    );
    return {
      sourceUrl,
      sessionId,
      data: result.data,
      cacheStatus: String((result as any).metadata?.cache?.status || ''),
    } satisfies BrowserbaseSessionResult<z.infer<typeof CompanySchema>>;
  }, geo);
}

export async function browseWithBrowserbase(rawUrl: string, geo?: BrowserbaseGeo) {
  return withStagehand(rawUrl, async (stagehand, _page, sessionId, sourceUrl) => {
    const result = await stagehand.extract(
      'Extract the page title, a concise summary of the visible page, and the most useful visible links with their absolute URLs.',
      PageSchema,
    );
    return {
      sourceUrl,
      sessionId,
      data: result.data,
      cacheStatus: String((result as any).metadata?.cache?.status || ''),
    } satisfies BrowserbaseSessionResult<z.infer<typeof PageSchema>>;
  }, geo);
}

export async function prepareFormWithBrowserbase(rawUrl: string, geo?: BrowserbaseGeo) {
  return withStagehand(rawUrl, async (stagehand, _page, sessionId, sourceUrl) => {
    const observed = await stagehand.observe('Find every visible form field, dropdown, checkbox, radio group, file upload, and submit control. Describe what each field expects. Do not submit anything.');
    const actions = (observed.data || []).map((item: any) => ({
      description: String(item.description || ''),
      method: String(item.method || ''),
      arguments: Array.isArray(item.arguments) ? item.arguments : [],
    }));
    return {
      sourceUrl,
      sessionId,
      data: {
        fields: actions,
        mode: 'prepare-only' as const,
        confirmationRequiredForSubmission: true,
      },
      cacheStatus: String((observed as any).metadata?.cache?.status || ''),
    };
  }, geo);
}

export async function fillFormWithBrowserbase(
  rawUrl: string,
  values: Record<string, string>,
  geo?: BrowserbaseGeo,
) {
  return withStagehand(rawUrl, async (stagehand, _page, sessionId, sourceUrl) => {
    const observed = await stagehand.observe('Find every visible form field that can be filled. Do not click submit or any final confirmation control.');
    const normalizedValues = Object.entries(values).filter(([, value]) => String(value).trim());
    const filled: string[] = [];
    for (const field of observed.data || []) {
      const description = String((field as any).description || '').toLowerCase();
      const match = normalizedValues.find(([key]) => description.includes(key.toLowerCase().replace(/[_-]+/g, ' ')));
      if (!match) continue;
      await stagehand.act({ ...(field as any), arguments: [match[1]] });
      filled.push(match[0]);
    }
    return {
      sourceUrl,
      sessionId,
      data: { filled, mode: 'filled-not-submitted' as const, confirmationRequiredForSubmission: true },
      cacheStatus: String((observed as any).metadata?.cache?.status || ''),
    };
  }, geo);
}

async function pollDownloads(sessionId: string, timeoutMs = 45_000): Promise<Buffer> {
  const bb = client();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await bb.sessions.downloads.list(sessionId);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > 0) return buffer;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error('Browserbase download timed out.');
}

export async function downloadDocumentWithBrowserbase(rawUrl: string) {
  return withStagehand(rawUrl, async (_stagehand, page, sessionId, sourceUrl) => {
    if (!sessionId) throw new Error('Browserbase did not return a session ID for the download.');
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => undefined);
    const archive = await pollDownloads(sessionId);
    const zip = new AdmZip(archive);
    const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
    if (!entries.length) throw new Error('Browserbase returned a download archive with no files.');
    const file = entries[0];
    const bytes = file.getData();
    let text = '';
    if (file.entryName.toLowerCase().endsWith('.pdf') || bytes.subarray(0, 5).toString() === '%PDF-') {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(bytes) });
      try {
        const parsed = await parser.getText();
        text = String(parsed.text || '').slice(0, 24_000);
      } finally {
        await parser.destroy();
      }
    }
    return {
      sourceUrl,
      sessionId,
      data: {
        fileName: file.entryName,
        byteLength: bytes.byteLength,
        text,
      },
    };
  });
}

/**
 * Legacy compatibility entry point. Research should use Browserbase Search first;
 * Firecrawl remains a compatibility fallback. Fetch is for static content only.
 */
export async function fetchWithBrowserbase(
  rawUrl: string,
  _urlValidator: typeof validatePublicUrl = validatePublicUrl,
  crawler: typeof crawlWebsite = crawlWebsite,
): Promise<BrowserbasePage> {
  if (process.env.BROWSERBASE_API_KEY?.trim()) return fetchWithBrowserbaseDirect(rawUrl, _urlValidator);
  if (!process.env.FIRECRAWL_API_KEY?.trim()) throw new Error('Website research is not configured.');
  const result = await crawler(rawUrl);
  const content = result.pages.map((page) => `${page.title}\n${page.url}\n${page.content}`).join('\n\n').slice(0, 24_000);
  if (!content.trim()) throw new Error('Website research completed, but no readable content was returned.');
  return {
    sourceUrl: result.sourceUrl,
    requestId: 'firecrawl-research',
    statusCode: 200,
    contentType: 'text/markdown',
    content,
    provider: 'firecrawl',
  };
}
