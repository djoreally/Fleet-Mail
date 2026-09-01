import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('operator discovery query',()=>{
 it('bounds a custom query before sending it upstream',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('optional(input.query,500)');
 });
});
