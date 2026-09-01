import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery defaults',()=>{
 it('defaults to ten results and generic commercial businesses',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("||'commercial businesses'");
  expect(source).toContain('bounded(input.limit,1,20,10)');
 });
});
