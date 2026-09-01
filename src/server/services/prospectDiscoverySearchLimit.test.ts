import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl discovery request limits',()=>{
 it('caps upstream search at twenty results',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain('Math.min(20, Math.max(1, limit))');
 });
});
