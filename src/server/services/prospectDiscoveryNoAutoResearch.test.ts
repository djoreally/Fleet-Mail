import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery workflow separation',()=>{
 it('does not crawl every search result during discovery',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).toContain('searchWeb(');
  expect(discover).not.toContain('crawlWebsite(');
  expect(discover).not.toContain('callAICompletion(');
 });
});
