import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect research contact boundary',()=>{
 it('does not create contacts from the website research model output',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const research=source.slice(source.indexOf('async research('),source.indexOf('async convertToFleetAccount('));
  expect(research).not.toContain('addContact(');
  expect(research).not.toContain('prospectContacts');
 });
});
