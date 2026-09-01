import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery overfetch',()=>{
 it('requests at most twice the desired count to allow filtering and dedupe',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('Math.min(20,limit*2)');
 });
});
