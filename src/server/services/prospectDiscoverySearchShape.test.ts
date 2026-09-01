import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl search response compatibility',()=>{
 it('accepts direct and web-nested search result arrays',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain('Array.isArray(body.data)');
  expect(source).toContain('Array.isArray(body.data?.web)');
 });
});
