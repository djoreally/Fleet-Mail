import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl search errors',()=>{
 it('uses the shared provider error handling for discovery search',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain('if (!response.ok) throw new Error(body.error || `Firecrawl request failed (${response.status}).`)');
 });
});
