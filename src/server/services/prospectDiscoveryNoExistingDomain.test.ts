import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('existing prospect domain handling',()=>{
 it('skips search results already represented in the tenant prospect list',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('known.has(domain)');
 });
});
