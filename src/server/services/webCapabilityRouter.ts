import { crawlWebsite, extractWebsiteUrl, searchWeb } from './firecrawl.js';
import { fetchWithBrowserbaseDirect } from './browserbase.js';
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

/**
 * Executes one deterministic web capability. The language model never chooses a
 * provider directly; it receives only this normalized result after execution.
 * Research is Firecrawl-only. Browserbase is reserved for explicit browser work.
 */
export async function executeWebCapability(userText: string, plan: AgentToolPlan): Promise<WebCapabilityResult> {
  const startedAt = Date.now();
  const capability = resolveWebCapability(plan);
  if (capability === 'none') {
    return { capability, provider: 'none', status: 'skipped', sourceUrls: [], content: null, durationMs: 0 };
  }

  const prior = cached(capability, userText);
  if (prior) return { ...prior, durationMs: 0 };

  const url = extractWebsiteUrl(userText);
  try {
    if (capability === 'research') {
      if (!process.env.FIRECRAWL_API_KEY?.trim()) throw new Error('Web research is not configured.');
      if (url) {
        const result = await crawlWebsite(url);
        return remember(capability, userText, {
          capability,
          provider: 'firecrawl',
          status: 'success',
          sourceUrls: result.pages.map((page) => page.url),
          content: result,
          durationMs: Date.now() - startedAt,
        });
      }
      const query = cleanSearchQuery(userText);
      if (!query) throw new Error('A search query or website URL is required.');
      const results = await searchWeb(query, { limit: 8 });
      return remember(capability, userText, {
        capability,
        provider: 'firecrawl',
        status: 'success',
        sourceUrls: results.map((result) => result.url),
        content: { query, results },
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
        error: 'A direct HTTPS URL is required for browser interaction.',
        durationMs: Date.now() - startedAt,
      };
    }

    if (!process.env.BROWSERBASE_API_KEY?.trim()) throw new Error('Browser interaction is not configured.');

    // Browserbase read/navigation is safe to execute immediately. Mutating form
    // submission remains a confirmation-gated action and is not auto-submitted.
    const page = await fetchWithBrowserbaseDirect(url);
    if (capability === 'form') {
      return remember(capability, userText, {
        capability,
        provider: 'browserbase',
        status: 'success',
        sourceUrls: [page.sourceUrl],
        content: {
          page,
          mode: 'prepare-only',
          confirmationRequiredForSubmission: true,
          instruction: 'Inspect the rendered form and prepare field mappings; do not submit without explicit confirmation.',
        },
        durationMs: Date.now() - startedAt,
      });
    }

    return remember(capability, userText, {
      capability,
      provider: 'browserbase',
      status: 'success',
      sourceUrls: [page.sourceUrl],
      content: page,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return {
      capability,
      provider: capability === 'research' ? 'firecrawl' : 'browserbase',
      status: 'failed',
      sourceUrls: url ? [url] : [],
      content: null,
      error: error instanceof Error ? error.message : 'Web capability failed.',
      durationMs: Date.now() - startedAt,
    };
  }
}
