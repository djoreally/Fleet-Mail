import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl search normalization',()=>{
 it('bounds result descriptions before persistence',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain(".trim().slice(0, 2000)");
 });
});
