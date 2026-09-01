import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl discovery configuration',()=>{
 it('fails clearly when the shared Firecrawl key is missing',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain('Website crawling is not configured yet. Add FIRECRAWL_API_KEY to the production environment.');
 });
});
