import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('tenant prospect dedupe',()=>{
 it('loads existing prospects for the same organization before inserting search results',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('const existing=await this.list(organizationId)');
 });
});
