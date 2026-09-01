import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('discovery opportunity safety',()=>{
 it('does not invent opportunity value or close probability from search results',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).not.toContain('opportunityValue:');
  expect(discover).not.toContain('probability:');
 });
});
