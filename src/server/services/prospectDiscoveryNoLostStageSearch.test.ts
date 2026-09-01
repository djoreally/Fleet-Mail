import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery lost-stage boundary',()=>{
 it('does not mark a candidate lost from search discovery',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).not.toContain("stage:'lost'");
 });
});
