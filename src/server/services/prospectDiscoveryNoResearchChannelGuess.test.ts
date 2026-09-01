import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect research provider attribution',()=>{
 it('records Firecrawl as the research channel',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("channel:'firecrawl'");
 });
});
