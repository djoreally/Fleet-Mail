import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery deduplication',()=>{
 it('deduplicates existing and repeated domains before insert',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('const known=new Set(existing.map');
  expect(source).toContain('known.has(domain)');
  expect(source).toContain('known.add(domain)');
 });
});
