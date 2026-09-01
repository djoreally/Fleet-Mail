import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery provider data bounds',()=>{
 it('limits search descriptions before they enter prospect metadata',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain('.slice(0, 2000)');
 });
});
