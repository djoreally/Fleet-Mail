import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('discovery geography requirement',()=>{
 it('requires location before any provider search',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover.indexOf("required(input.location,'Location',200)")).toBeLessThan(discover.indexOf('searchWeb('));
 });
});
