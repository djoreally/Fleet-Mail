import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('current prospecting provider scope',()=>{
 it('documents Firecrawl as the discovery provider without paid data brokers',async()=>{
  const doc=await readFile(new URL('../../../docs/prospect-discovery.md',import.meta.url),'utf8');
  expect(doc).toContain('Firecrawl web search');
  for(const provider of ['Apollo','ZoomInfo','Clearbit']) expect(doc).not.toContain(provider);
 });
});
