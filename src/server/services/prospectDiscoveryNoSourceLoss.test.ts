import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery provenance fields',()=>{
 it('stores source, source URL, effective query, and search description',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  for(const token of ["source:'firecrawl_search'",'sourceUrl:result.url','discoveryQuery:query','discoveryDescription:result.description']) expect(source).toContain(token);
 });
});
