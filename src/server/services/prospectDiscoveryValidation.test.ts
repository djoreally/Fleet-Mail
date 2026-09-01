import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery validation',()=>{
 it('requires an explicit location so searches remain geographically intentional',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("required(input.location,'Location',200)");
 });
});
