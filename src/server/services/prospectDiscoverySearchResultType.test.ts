import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl search result contract',()=>{
 it('defines a minimal normalized public search result type',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain('export interface SearchResult { url: string; title: string; description: string; }');
 });
});
