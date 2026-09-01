import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('discovery phone safety',()=>{
 it('does not manufacture phone numbers from search snippets',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).not.toContain('phone:');
 });
});
