import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery write scope',()=>{
 it('persists only through canonical prospect creation',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).toContain('this.create(organizationId');
  expect(discover).not.toContain('database().insert');
  expect(discover).not.toContain('database().update');
 });
});
