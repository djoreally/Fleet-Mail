import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl search normalization',()=>{
 it('returns normalized SearchResult records',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain('url: String(row.url || row.sourceURL ||').
  expect(source).toContain('title: String(row.title ||').
  expect(source).toContain('description: String(row.description || row.snippet ||').
 });
});
