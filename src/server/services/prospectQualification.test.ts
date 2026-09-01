import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect qualification contract',()=>{
 it('does not automatically qualify weak research results',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("const nextStage=score>=40?'qualified':'researching'");
  expect(source).toContain('Do not invent fleet size; use null when unsupported.');
  expect(source).toContain("channel:'firecrawl'");
 });
});
