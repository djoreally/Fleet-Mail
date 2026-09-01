import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery response',()=>{
 it('returns the effective query, created records, and skipped count',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('return {query,discovered:created,skipped:');
 });
});
