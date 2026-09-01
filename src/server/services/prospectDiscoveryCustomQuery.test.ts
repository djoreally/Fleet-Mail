import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('targeted prospect discovery',()=>{
 it('supports an operator supplied query while retaining location',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('optional(input.query,500)||');
  expect(source).toContain("required(input.location,'Location',200)");
 });
});
