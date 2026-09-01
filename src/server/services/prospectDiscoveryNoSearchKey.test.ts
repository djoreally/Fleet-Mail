import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('discovery credential reuse',()=>{
 it('uses FIRECRAWL_API_KEY instead of adding another search credential',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain('process.env.FIRECRAWL_API_KEY');
  expect(source).not.toContain('SEARCH_API_KEY');
 });
});
