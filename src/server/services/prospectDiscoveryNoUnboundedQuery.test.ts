import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery query bounds',()=>{
 it('limits both operator and provider search query lengths',async()=>{
  const [prospecting,firecrawl]=await Promise.all([
   readFile(new URL('./prospecting.ts',import.meta.url),'utf8'),
   readFile(new URL('./firecrawl.ts',import.meta.url),'utf8'),
  ]);
  expect(prospecting).toContain('optional(input.query,500)');
  expect(firecrawl).toContain('query.trim().slice(0, 500)');
 });
});
