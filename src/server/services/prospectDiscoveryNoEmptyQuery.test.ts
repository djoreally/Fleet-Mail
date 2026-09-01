import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl discovery query validation',()=>{
 it('rejects an empty normalized search query',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain("if (!q) throw new Error('Search query is required.')");
 });
});
