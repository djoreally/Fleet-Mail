import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect research browser boundary',()=>{
 it('uses Firecrawl crawling rather than Browserbase for qualification research',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('crawlWebsite(website)');
  expect(source.toLowerCase()).not.toContain('browserbase');
 });
});
