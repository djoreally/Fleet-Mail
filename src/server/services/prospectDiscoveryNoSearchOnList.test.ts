import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect list side effects',()=>{
 it('does not call Firecrawl while listing existing prospects',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const list=source.slice(source.indexOf('async list('),source.indexOf('async get('));
  expect(list).not.toContain('searchWeb(');
  expect(list).not.toContain('crawlWebsite(');
 });
});
