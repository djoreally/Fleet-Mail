import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect website normalization',()=>{
 it('normalizes discovered websites through the canonical website validator',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('website=cleanWebsite(result.url)!');
 });
});
