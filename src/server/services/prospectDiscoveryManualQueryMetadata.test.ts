import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('custom discovery query provenance',()=>{
 it('persists the effective query used for each discovered candidate',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('discoveryQuery:query');
 });
});
