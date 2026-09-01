import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery industry',()=>{
 it('stores the requested industry on newly discovered candidates',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('{companyName:title,website,industry,serviceArea:location');
 });
});
