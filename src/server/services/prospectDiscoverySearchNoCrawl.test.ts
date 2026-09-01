import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl search/crawl separation',()=>{
 it('implements search as a separate operation from website crawling',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain('export async function searchWeb');
  expect(source).toContain('export async function crawlWebsite');
 });
});
