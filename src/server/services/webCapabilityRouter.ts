import { crawlWebsite, extractWebsiteUrl, searchWeb } from './firecrawl.js';
import {
  browseWithBrowserbase,
  downloadDocumentWithBrowserbase,
  extractCompanyWithBrowserbase,
  prepareFormWithBrowserbase,
  searchWithBrowserbase,
} from './browserbase.js';
import type { AgentToolPlan } from './agentToolRouter.js';

export type WebCapability = 'none' | 'research' | 'browse' | 'document' | 'form';
export type WebProvider = 'none' | 'firecrawl' | 'browserbase';

export interface WebCapabilityResult {
  capability: WebCapability;
  provider: WebProvider;
  status: 'success' | 'skipped' | 'blocked' | 'failed';
  sourceUrls: string[];
  content: unknown;
  error?: string;
  durationMs: number;
  sessionId?: string;
  cacheStatus?: string;
}

const CACHE_TTL_MS = 10 * 60_000;
const cache = new Map<string, { expiresAt: number; value: WebCapabilityResult }>();

function cacheKey(capability: WebCapability, text: string) {
  return `${capability}:${text.trim().toLowerCase()}`;
}

function cached(capability: WebCapability, text: string) {
  const key = cacheKey(capability, text);
  const item = cache.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function remember(capability: WebCapability, text: string, value: WebCapabilityResult) {
  if (value.status !== 'success') return value;
  cache.set(cacheKey(capability, text), { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}

function cleanSearchQuery(text: string) {
  return text
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\b(?:research|search the web|look up online|look up|find online|website|web research)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

export function resolveWebCapability(plan: AgentToolPlan): WebCapability {
  if (plan.webCapability) return plan.webCapability;
  if (plan.webMode === 'research') return 'research';
  if (plan.webMode === 'browser') return 'browse';
  return 'none';
}

async function researchWithFallback(userText: string, url: string | null) {
  let browserbaseError: unknown = null;
  if (process.env.BROWSERBASE_API_KEY?.trim()) {
    try {
      if (url) {
        const result = await extractCompanyWithBrowserbase(url);
        return {
          provider: 'browserbase' as const,
          sourceUrls: [result.sourceUrl],
          content: result.data,
          sessionId: result.sessionId,
          cacheStatus: result.cacheStatus,
        };
      }
      const query = cleanSearchQuery(userText);
      if (!query) throw new Error('A search query or website URL is required.');
      const results = await searchWithBrowserbase(query, 8);
      if (!results.length) throw new Error('The Browserbase web search returned no results.');
      return {
        provider: 'browserbase' as const,
        sourceUrls: results.map((result) => result.url),
        content: { query, results },
      };
    } catch (error) {
      browserbaseError = error;
      console.warn('Browserbase research unavailable, attempting Firecrawl fallback:', error instanceof Error ? error.message : error);
    }
  }

  if (!process.env.FIRECRAWL_API_KEY?.trim()) {
    if (browserbaseError instanceof Error) throw browserbaseError;
    throw new Error('Open-web research is not configured.');
  }
  if (url) {
    const result = await crawlWebsite(url);
    return {
      provider: 'firecrawl' as const,
      sourceUrls: result.pages.map((page) => page.url),
      content: result,
    };
  }
  const query = cleanSearchQuery(userText);
  if (!query) throw new Error('A search query or website URL is required.');
  const results = await searchWeb(query, { limit: 8 });
  if (!results.length) throw new Error('The web search returned no results.');
  return {
    provider: 'firecrawl' as const,
    sourceUrls: results.map((result) => result.url),
    content: { query, results },
  };
}

/** Execute exactly one server-owned web capability. */
export async function executeWebCapability(userText: string, plan: AgentToolPlan): Promise<WebCapabilityResult> {
  const startedAt = Date.now();
  const capability = resolveWebCapability(plan);
  if (capability === 'none') {
    return { capability, provider: 'none', status: 'skipped', sourceUrls: [], content: null, durationMs: 0 };
  }

  const prior = cached(capability, userText);
  if (prior) return { ...prior, durationMs: 0, cacheStatus: prior.cacheStatus || 'fleet-runtime-hit' };

  const url = extractWebsiteUrl(userText);
  try {
    if (capability === 'research') {
      const result = await researchWithFallback(userText, url);
      return remember(capability, userText, {
        capability,
        provider: result.provider,
        status: 'success',
        sourceUrls: result.sourceUrls,
        content: result.content,
        sessionId: result.sessionId,
        cacheStatus: result.cacheStatus,
        durationMs: Date.now() - startedAt,
      });
    }

    if (!url) {
      return {
        capability,
        provider: 'browserbase',
        status: 'blocked',
        sourceUrls: [],
        content: null,
        error: 'A direct HTTPS URL is required for this browser task.',
        durationMs: Date.now() - startedAt,
      };
    }

    if (!process.env.BROWSERBASE_API_KEY?.trim()) throw new Error('Browser interaction is not configured.');

    if (capability === 'browse') {
      const result = await browseWithBrowserbase(url);
      return remember(capability, userText, {
        capability,
        provider: 'browserbase',
        status: 'success',
        sourceUrls: [result.sourceUrl],
        content: result.data,
        sessionId: result.sessionId,
        cacheStatus: result.cacheStatus,
        durationMs: Date.now() - startedAt,
      });
    }

    if (capability === 'form') {
      const result = await prepareFormWithBrowserbase(url);
      return remember(capability, userText, {
        capability,
        provider: 'browserbase',
        status: 'success',
        sourceUrls: [result.sourceUrl],
        content: result.data,
        sessionId: result.sessionId,
        cacheStatus: result.cacheStatus,
        durationMs: Date.now() - startedAt,
      });
    }

    if (capability === 'document') {
      const result = await downloadDocumentWithBrowserbase(url);
      return remember(capability, userText, {
        capability,
        provider: 'browserbase',
        status: 'success',
        sourceUrls: [result.sourceUrl],
        content: result.data,
        sessionId: result.sessionId,
        durationMs: Date.now() - startedAt,
      });
    }

    return {
      capability,
      provider: 'none',
      status: 'skipped',
      sourceUrls: [],
      content: null,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      capability,
      provider: capability === 'research' && !process.env.BROWSERBASE_API_KEY?.trim() ? 'firecrawl' : 'browserbase',
      status: 'failed',
      sourceUrls: url ? [url] : [],
      content: null,
      error: error instanceof Error ? error.message : 'Web capability failed.',
      durationMs: Date.now() - startedAt,
    };
  }
}
