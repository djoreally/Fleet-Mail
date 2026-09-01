import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect conversion side effects',()=>{
 it('does not call Firecrawl while converting an already-qualified prospect',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const convert=source.slice(source.indexOf('async convertToFleetAccount('));
  expect(convert).not.toContain('searchWeb(');
  expect(convert).not.toContain('crawlWebsite(');
 });
});
