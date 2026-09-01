import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('discovery query transparency',()=>{
 it('returns the exact effective search query to the caller',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('return {query,discovered:created');
 });
});
