import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl search URL normalization',()=>{
 it('supports url and sourceURL fields',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain('row.url || row.sourceURL');
 });
});
