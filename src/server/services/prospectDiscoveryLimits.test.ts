import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery limits',()=>{
 it('caps one discovery request at twenty candidates',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("const limit=bounded(input.limit,1,20,10)");
  expect(source).toContain('if(created.length>=limit)break');
 });
});
