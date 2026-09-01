import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('discovery evidence metadata',()=>{
 it('stores search snippets without treating them as researched facts',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('notes:result.description');
  expect(source).toContain('stage,qualificationScore');
  expect(source).not.toContain("source:'firecrawl_search',stage:'qualified'");
 });
});
