import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery candidate bounds',()=>{
 it('caps requested and created candidates at twenty',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('bounded(input.limit,1,20,10)');
  expect(source).toContain('if(created.length>=limit)break');
 });
});
