import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect update side effects',()=>{
 it('does not call Firecrawl while editing prospect fields',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const update=source.slice(source.indexOf('async update('),source.indexOf('async addContact('));
  expect(update).not.toContain('searchWeb(');
  expect(update).not.toContain('crawlWebsite(');
 });
});
