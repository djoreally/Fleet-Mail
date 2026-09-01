import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('lightweight discovery search',()=>{
 it('normalizes only URL, title, and description from search results',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain('export interface SearchResult { url: string; title: string; description: string; }');
  const search=source.slice(source.indexOf('export async function searchWeb'),source.indexOf('export async function crawlWebsite'));
  expect(search).not.toContain('html');
  expect(search).not.toContain('markdown');
 });
});
