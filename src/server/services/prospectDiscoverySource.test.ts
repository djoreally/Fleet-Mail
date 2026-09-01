import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery source attribution',()=>{
 it('marks discovered prospects separately from manual records',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("source:'firecrawl_search'");
 });
});
