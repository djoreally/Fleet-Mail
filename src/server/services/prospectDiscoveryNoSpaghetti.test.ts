import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery layering',()=>{
 it('keeps provider normalization in firecrawl and domain persistence in prospecting',async()=>{
  const [firecrawl,prospecting]=await Promise.all([
   readFile(new URL('./firecrawl.ts',import.meta.url),'utf8'),
   readFile(new URL('./prospecting.ts',import.meta.url),'utf8'),
  ]);
  expect(firecrawl).toContain('export async function searchWeb');
  expect(firecrawl).not.toContain('prospects');
  expect(prospecting).toContain('searchWeb(query');
 });
});
