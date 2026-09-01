import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('search evidence attribution',()=>{
 it('keeps the result description and URL attributable to Firecrawl search',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("source:'firecrawl_search'");
  expect(source).toContain('sourceUrl:result.url');
  expect(source).toContain('discoveryDescription:result.description');
 });
});
