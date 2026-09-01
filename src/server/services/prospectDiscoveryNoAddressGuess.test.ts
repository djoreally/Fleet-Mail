import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('discovery address safety',()=>{
 it('does not manufacture a street address from search snippets',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).not.toContain('address:');
 });
});
