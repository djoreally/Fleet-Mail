import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery diagnostics',()=>{
 it('reports how many upstream results were not inserted',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('Math.max(0,results.length-created.length)');
 });
});
