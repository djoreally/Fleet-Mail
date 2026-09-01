import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery query',()=>{
 it('builds a fleet-oriented default from industry and location',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('`${industry} ${location} fleet vehicles company`');
  expect(source).toContain("required(input.location,'Location',200)");
 });
});
