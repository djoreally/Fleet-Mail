import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('evidence before qualification',()=>{
 it('does not mark search-result candidates qualified at insertion time',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).not.toContain("qualified'");
 });
});
