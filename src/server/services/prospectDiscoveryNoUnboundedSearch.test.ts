import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl search bounds',()=>{
 it('normalizes the provider limit to one through twenty',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain('Math.min(20, Math.max(1, limit))');
 });
});
