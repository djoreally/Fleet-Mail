import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl discovery provider',()=>{
 it('uses the existing Firecrawl v2 API and web search source',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain("const API_BASE = 'https://api.firecrawl.dev/v2'");
  expect(source).toContain("firecrawl('/search'");
  expect(source).toContain("sources: ['web']");
 });
});
