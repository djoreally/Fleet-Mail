import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect research grounding',()=>{
 it('instructs the model to use only supplied website evidence',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('Use only the supplied evidence.');
  expect(source).toContain('Do not invent fleet size; use null when unsupported.');
 });
});
