import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('same-run prospect dedupe',()=>{
 it('adds a newly inserted domain to the known set',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('known.add(domain);created.push(row)');
 });
});
