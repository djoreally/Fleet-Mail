import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl search adapter AI boundary',()=>{
 it('contains no model calls',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).not.toContain('callAICompletion');
  expect(source).not.toContain('OPENAI');
 });
});
