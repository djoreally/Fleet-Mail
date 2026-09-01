import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery tenant read bound',()=>{
 it('reuses the prospect list query with its five-hundred-row bound',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('.limit(500)');
  expect(source).toContain('const existing=await this.list(organizationId)');
 });
});
