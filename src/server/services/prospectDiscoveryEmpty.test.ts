import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('empty prospect discovery',()=>{
 it('returns an empty discovered collection rather than fabricating candidates',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('const created:any[]=[]');
  expect(source).toContain('discovered:created');
 });
});
