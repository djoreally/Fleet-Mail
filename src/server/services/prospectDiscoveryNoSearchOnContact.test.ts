import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect contact side effects',()=>{
 it('does not call Firecrawl while manually adding a contact',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const contact=source.slice(source.indexOf('async addContact('),source.indexOf('async addActivity('));
  expect(contact).not.toContain('searchWeb(');
  expect(contact).not.toContain('crawlWebsite(');
 });
});
