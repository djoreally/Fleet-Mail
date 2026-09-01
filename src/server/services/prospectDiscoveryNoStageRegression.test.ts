import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect research stage preservation',()=>{
 it('does not regress outreach or later stages during re-research',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("detail.prospect.stage==='new'||detail.prospect.stage==='researching'?nextStage:detail.prospect.stage");
 });
});
