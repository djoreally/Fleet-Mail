import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl search adapter browser boundary',()=>{
 it('contains no Browserbase calls',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source.toLowerCase()).not.toContain('browserbase');
 });
});
