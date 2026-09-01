import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('discovery qualification separation',()=>{
 it('does not assign a qualified stage during discovery creation',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).not.toContain("stage:'qualified'");
  expect(discover).not.toContain("stage:'researching'");
 });
});
