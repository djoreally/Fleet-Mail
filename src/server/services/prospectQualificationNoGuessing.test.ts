import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect fleet-size evidence policy',()=>{
 it('explicitly tells qualification to return null when fleet size is unsupported',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('Do not invent fleet size; use null when unsupported.');
 });
});
