import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery contact safety',()=>{
 it('does not invent contacts or email addresses from search results',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).not.toContain('addContact(');
  expect(discover).not.toContain('generalEmail:');
 });
});
