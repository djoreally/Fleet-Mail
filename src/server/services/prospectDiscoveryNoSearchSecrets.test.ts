import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl discovery secret handling',()=>{
 it('reads the provider key only inside the shared Firecrawl transport',async()=>{
  const [firecrawl,prospecting]=await Promise.all([
   readFile(new URL('./firecrawl.ts',import.meta.url),'utf8'),
   readFile(new URL('./prospecting.ts',import.meta.url),'utf8'),
  ]);
  expect(firecrawl).toContain('process.env.FIRECRAWL_API_KEY');
  expect(prospecting).not.toContain('FIRECRAWL_API_KEY');
 });
});
