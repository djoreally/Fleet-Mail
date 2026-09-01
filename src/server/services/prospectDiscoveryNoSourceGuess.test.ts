import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery attribution',()=>{
 it('explicitly attributes discovered records to Firecrawl search',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("source:'firecrawl_search'");
 });
});
