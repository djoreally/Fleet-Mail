import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery search source',()=>{
 it('requests public web results rather than images or news',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain("sources: ['web']");
  const search=source.slice(source.indexOf('export async function searchWeb'),source.indexOf('export async function crawlWebsite'));
  expect(search).not.toContain("'images'");
  expect(search).not.toContain("'news'");
 });
});
