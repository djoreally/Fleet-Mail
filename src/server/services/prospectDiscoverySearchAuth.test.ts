import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl discovery authentication',()=>{
 it('routes search through the existing authenticated Firecrawl helper',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain('Authorization: `Bearer ${apiKey}`');
  expect(source).toContain("await firecrawl('/search'");
 });
});
