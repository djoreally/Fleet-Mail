import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect source separation',()=>{
 it('labels discovery as Firecrawl search and research activity as Firecrawl crawl evidence',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("source:'firecrawl_search'");
  expect(source).toContain("channel:'firecrawl'");
 });
});
