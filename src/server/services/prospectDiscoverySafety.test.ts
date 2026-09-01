import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery tool boundary',()=>{
 it('uses Firecrawl search and does not import Browserbase',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("import { crawlWebsite, searchWeb } from './firecrawl.js'");
  expect(source.toLowerCase()).not.toContain("from './browserbase");
  expect(source).toContain("source:'firecrawl_search'");
 });
});
