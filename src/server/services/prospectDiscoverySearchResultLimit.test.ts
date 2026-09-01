import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl search result bound',()=>{
 it('passes a one-to-twenty result limit upstream',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain('limit: Math.min(20, Math.max(1, limit))');
 });
});
