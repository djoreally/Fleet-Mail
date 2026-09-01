import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery documentation',()=>{
 it('documents the public API and tool boundary',async()=>{
  const doc=await readFile(new URL('../../../docs/prospect-discovery.md',import.meta.url),'utf8');
  expect(doc).toContain('POST /api/prospects/discover');
  expect(doc).toContain('Firecrawl: search, discovery, crawl, public-web research.');
 });
});
