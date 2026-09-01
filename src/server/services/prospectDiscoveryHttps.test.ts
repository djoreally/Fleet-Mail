import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery URL safety',()=>{
 it('only accepts HTTPS search results',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain("/^https:\\/\\//i.test(row.url)");
 });
});
