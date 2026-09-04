import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Browserbase production implementation contract', () => {
  const browser = readFileSync('src/server/services/browserbase.ts', 'utf8');
  const router = readFileSync('src/server/services/webCapabilityRouter.ts', 'utf8');
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const contract = readFileSync('docs/browserbase-production-implementation.md', 'utf8');

  it('pins the current Stagehand v4 runtime requirements', () => {
    expect(packageJson.dependencies['@browserbasehq/stagehand']).toBe('4.0.2');
    expect(packageJson.dependencies['@browserbasehq/sdk']).toBeTruthy();
    expect(packageJson.dependencies.zod).toBeTruthy();
    expect(packageJson.engines.node).toBe('>=22.18.0');
  });

  it('implements Browserbase Search and Fetch primitives', () => {
    // Browserbase Search currently uses the documented direct HTTP API; Fetch uses the SDK.
    expect(browser).toContain('https://api.browserbase.com/v1/search');
    expect(browser).toContain("'X-BB-API-Key': apiKey()");
    expect(browser).toContain('client().fetchAPI.create');
    expect(router).toContain('searchWithBrowserbase');
  });

  it('implements Stagehand typed extraction and real browser sessions', () => {
    expect(browser).toContain('browserbase.launch');
    expect(browser).toContain('Stagehand.create');
    expect(browser).toContain('stagehand.extract');
    expect(browser).toContain('CompanySchema');
    expect(browser).toContain('browser.sessionId');
  });

  it('implements form observation without implicit submission', () => {
    expect(browser).toContain('stagehand.observe');
    expect(browser).toContain("mode: 'prepare-only'");
    expect(browser).toContain('confirmationRequiredForSubmission: true');
    expect(contract).toContain('Submission is never implicit');
  });

  it('implements Browserbase Downloads and PDF parsing', () => {
    expect(browser).toContain('sessions.downloads.list');
    expect(browser).toContain("import('pdf-parse')");
    expect(browser).toContain('AdmZip');
  });

  it('implements Browserbase geolocation proxies and caching', () => {
    expect(browser).toContain("type: 'browserbase' as const");
    expect(browser).toContain('geolocation');
    expect(browser).toContain('cache: { threshold: 1 }');
    expect(browser).toContain('metadata?.cache?.status');
  });

  it('keeps provider selection on the server rather than in the LLM', () => {
    expect(router).toContain('executeWebCapability');
    expect(router).toContain('process.env.BROWSERBASE_API_KEY');
    expect(contract).toContain('The model never receives Browserbase credentials');
  });
});
