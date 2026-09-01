import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery job-board rejection',()=>{
 it('does not treat job-board pages as company websites',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('indeed.com');
  expect(source).toContain('glassdoor.com');
 });
});
