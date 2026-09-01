import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery directory rejection',()=>{
 it('uses a centralized blocked-host set',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('const BLOCKED_HOSTS=new Set');
  expect(source).toContain('BLOCKED_HOSTS.has(domain)');
 });
});
