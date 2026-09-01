import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery side effects',()=>{
 it('only persists prospect candidates during discovery',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).toContain('this.create(organizationId');
  expect(discover).not.toContain('addContact(');
  expect(discover).not.toContain('addActivity(');
  expect(discover).not.toContain('convertToFleetAccount(');
 });
});
