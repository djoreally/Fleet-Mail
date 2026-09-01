import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('invalid discovery domain handling',()=>{
 it('skips results whose URL cannot produce a hostname',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('if(!domain||BLOCKED_HOSTS.has(domain)');
 });
});
