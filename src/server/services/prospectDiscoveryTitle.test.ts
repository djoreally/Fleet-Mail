import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('discovered company naming',()=>{
 it('uses a search title with domain fallback',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('(result.title||domain)');
  expect(source).toContain('||domain;');
 });
});
