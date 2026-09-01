import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery credentials',()=>{
 it('does not introduce a new Google search API key requirement',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).not.toContain('GOOGLE_SEARCH');
  expect(source).not.toContain('GOOGLE_PLACES');
 });
});
