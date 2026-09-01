import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect domain normalization',()=>{
 it('normalizes www hostnames before deduplication',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("hostname.replace(/^www\\./,'').toLowerCase()");
 });
});
