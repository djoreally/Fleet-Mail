import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

const API_BASE = 'https://api.firecrawl.dev/v2';
const PRIVATE_V4 = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;
const PRIVATE_V6 = /^(?:::1$|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/i;

export interface CrawledPage { url: string; title: string; content: string; }
export interface CrawlResult { sourceUrl: string; pages: CrawledPage[]; }
export interface SearchResult { url: string; title: string; description: string; }

function blockedAddress(address: string) {
  return isIP(address) === 4 ? PRIVATE_V4.test(address) : isIP(address) === 6 ? PRIVATE_V6.test(address) : true;
}

export async function validatePublicUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('Only secure HTTPS website URLs can be crawled.');
  if (url.username || url.password || url.port) throw new Error('Website URLs cannot include credentials or custom ports.');
  if (url.hostname === 'localhost' || url.hostname.endsWith('.local')) throw new Error('Local network websites cannot be crawled.');
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => blockedAddress(address))) throw new Error('Private or local network websites cannot be crawled.');
  return url;
}

async function firecrawl(path: string, init?: RequestInit) {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) throw new Error('Website crawling is not configured yet. Add FIRECRAWL_API_KEY to the production environment.');
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...init?.headers }, signal: AbortSignal.timeout(18_000) });
  const body = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new Error(body.error || `Firecrawl request failed (${response.status}).`);
  return body;
}

export async function searchWeb(query: string, limit = 10): Promise<SearchResult[]> {
  const q = query.trim().slice(0, 500);
  if (!q) throw new Error('Search query is required.');
  const body = await firecrawl('/search', { method: 'POST', body: JSON.stringify({ query: q, limit: Math.min(20, Math.max(1, limit)), sources: ['web'] }) });
  const rows = Array.isArray(body.data) ? body.data : Array.isArray(body.data?.web) ? body.data.web : [];
  return rows.map((row: any) => ({
    url: String(row.url || row.sourceURL || '').trim(),
    title: String(row.title || '').trim(),
    description: String(row.description || row.snippet || '').trim().slice(0, 2000),
  })).filter((row: SearchResult) => /^https:\/\//i.test(row.url));
}

export async function crawlWebsite(rawUrl: string): Promise<CrawlResult> {
  const url = await validatePublicUrl(rawUrl);
  const started = await firecrawl('/crawl', { method: 'POST', body: JSON.stringify({ url: url.href, limit: 5, maxDiscoveryDepth: 1, sitemap: 'skip', ignoreQueryParameters: true, scrapeOptions: { formats: ['markdown'], onlyMainContent: true, mobile: true } }) });
  if (!started.id) throw new Error('Firecrawl did not return a crawl job.');
  const deadline = Date.now() + 16_000;
  let result: any;
  while (Date.now() < deadline) {
    result = await firecrawl(`/crawl/${encodeURIComponent(started.id)}`);
    if (result.status === 'completed') break;
    if (result.status === 'failed' || result.status === 'cancelled') throw new Error('The website crawl did not complete.');
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  if (result?.status !== 'completed') throw new Error('The website is still being crawled. Please try again in a moment.');
  const pages = (Array.isArray(result.data) ? result.data : []).slice(0, 5).map((page: any) => ({
    url: String(page.metadata?.sourceURL || page.metadata?.url || url.href),
    title: String(page.metadata?.title || page.metadata?.ogTitle || url.hostname),
    content: String(page.markdown || page.content || '').slice(0, 12_000),
  })).filter((page: CrawledPage) => page.content);
  if (!pages.length) throw new Error('The website was crawled, but no readable page content was returned.');
  return { sourceUrl: url.href, pages };
}

export function extractWebsiteUrl(message: string) {
  const matches = message.match(/https:\/\/[^\s<>()"']+/gi) || [];
  return matches[0]?.replace(/[.,;:!?]+$/, '') || null;
}
