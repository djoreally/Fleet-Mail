import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery sales disposition',()=>{
 it('does not mark discovered candidates won or lost',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).not.toContain('lostReason');
  expect(discover).not.toContain("stage:'won'");
  expect(discover).not.toContain("stage:'lost'");
 });
});
