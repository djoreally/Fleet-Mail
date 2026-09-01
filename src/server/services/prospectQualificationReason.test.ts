import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect qualification rationale',()=>{
 it('stores the model rationale alongside the evidence score',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('qualificationReason:optional(parsed.qualificationReason,5000)');
 });
});
