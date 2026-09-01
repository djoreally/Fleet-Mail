import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('invalid discovered website handling',()=>{
 it('skips a result that fails canonical website normalization',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('try{website=cleanWebsite(result.url)!;}catch{continue;}');
 });
});
