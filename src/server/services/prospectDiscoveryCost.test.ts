import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery cost control',()=>{
 it('searches at most twice the requested candidate count and never above twenty',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('searchWeb(query,Math.min(20,limit*2))');
 });
});
