import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('public-web prospect discovery',()=>{
 it('requests only Firecrawl web search results',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain("sources: ['web']");
 });
});
