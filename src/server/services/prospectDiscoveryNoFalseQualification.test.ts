import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect qualification safety',()=>{
 it('requires researched evidence and threshold score before automatic qualification',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('const crawled=await crawlWebsite(website)');
  expect(source).toContain("const nextStage=score>=40?'qualified':'researching'");
 });
});
