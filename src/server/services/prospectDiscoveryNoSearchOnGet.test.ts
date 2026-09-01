import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect detail side effects',()=>{
 it('does not call Firecrawl while reading a prospect',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const get=source.slice(source.indexOf('async get('),source.indexOf('async create('));
  expect(get).not.toContain('searchWeb(');
  expect(get).not.toContain('crawlWebsite(');
 });
});
