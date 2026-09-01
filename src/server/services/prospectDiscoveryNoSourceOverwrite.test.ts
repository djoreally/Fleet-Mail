import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect source distinction',()=>{
 it('retains manual as the create default while discovery explicitly uses firecrawl_search',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("source:optional(input.source,100)||'manual'");
  expect(source).toContain("source:'firecrawl_search'");
 });
});
