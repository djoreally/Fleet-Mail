import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl provider data normalization',()=>{
 it('casts and trims search fields before returning them',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain("String(row.url || row.sourceURL || '').trim()");
  expect(source).toContain("String(row.title || '').trim()");
  expect(source).toContain("String(row.description || row.snippet || '').trim().slice(0, 2000)");
 });
});
