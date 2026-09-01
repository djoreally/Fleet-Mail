import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('initial fleet qualification threshold',()=>{
 it('requires a score of at least forty for automatic qualification',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('score>=40');
 });
});
