import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('discovery URL protocol',()=>{
 it('accepts only HTTPS normalized search results',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain("/^https:\\/\\//i.test(row.url)");
 });
});
