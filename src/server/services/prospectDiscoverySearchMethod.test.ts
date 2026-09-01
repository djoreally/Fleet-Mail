import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl search request',()=>{
 it('sends discovery search through a JSON POST request',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain("method: 'POST', body: JSON.stringify({ query: q");
 });
});
