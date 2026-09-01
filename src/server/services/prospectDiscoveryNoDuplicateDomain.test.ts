import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect website deduplication',()=>{
 it('compares normalized hostnames instead of full URLs',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("function host(value:string)");
  expect(source).toContain('existing.map(p=>p.website?host(p.website)');
 });
});
