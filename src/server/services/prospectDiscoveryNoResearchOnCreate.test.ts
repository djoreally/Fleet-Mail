import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect create side effects',()=>{
 it('does not trigger Firecrawl research from canonical create',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const create=source.slice(source.indexOf('async create('),source.indexOf('async update('));
  expect(create).not.toContain('crawlWebsite(');
  expect(create).not.toContain('searchWeb(');
 });
});
