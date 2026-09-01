import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery environment',()=>{
 it('uses the existing Firecrawl environment variable',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain('FIRECRAWL_API_KEY');
 });
});
