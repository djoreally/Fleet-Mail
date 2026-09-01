import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery lifecycle safety',()=>{
 it('does not convert discovered candidates into Fleet Accounts',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).not.toContain('convertToFleetAccount');
  expect(discover).not.toContain('customers');
 });
});
