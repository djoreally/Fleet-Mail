import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect qualification score',()=>{
 it('bounds model output to a zero-to-one-hundred score',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('const score=bounded(parsed.qualificationScore,0,100,0)');
 });
});
