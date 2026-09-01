import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery query handling',()=>{
 it('passes the bounded query as JSON data rather than constructing a provider URL',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain('JSON.stringify({ query: q');
  expect(source).not.toContain('`/search?query=');
 });
});
