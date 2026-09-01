import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('discovered prospect stage',()=>{
 it('relies on canonical create default stage rather than forcing a sales stage',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).not.toContain('stage:');
  expect(source).toContain("const stage=String(input.stage||'new')");
 });
});
