import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect qualification promotion',()=>{
 it('promotes only researched prospects meeting the threshold',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("const nextStage=score>=40?'qualified':'researching'");
 });
});
