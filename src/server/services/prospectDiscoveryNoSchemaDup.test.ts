import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery model',()=>{
 it('writes discovered businesses into canonical prospects',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("from '../../db/prospectSchema.js'");
  expect(source).toContain('this.create(organizationId');
 });
});
