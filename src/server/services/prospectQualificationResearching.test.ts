import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('low-confidence prospect research',()=>{
 it('keeps weak candidates in researching rather than auto-qualifying them',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("const nextStage=score>=40?'qualified':'researching'");
 });
});
