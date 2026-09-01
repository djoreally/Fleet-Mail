import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl discovery cost boundary',()=>{
 it('does not request scrape content during search discovery',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  const search=source.slice(source.indexOf('export async function searchWeb'),source.indexOf('export async function crawlWebsite'));
  expect(search).not.toContain('scrapeOptions');
  expect(search).not.toContain('formats:');
 });
});
