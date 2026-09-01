import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery industry bounds',()=>{
 it('limits industry input to two hundred characters',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('optional(input.industry,200)');
 });
});
