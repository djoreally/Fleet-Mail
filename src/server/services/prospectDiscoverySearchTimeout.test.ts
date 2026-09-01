import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl request timeout',()=>{
 it('keeps discovery requests bounded by the shared timeout',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain('AbortSignal.timeout(18_000)');
 });
});
