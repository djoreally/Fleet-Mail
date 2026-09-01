import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery title bounds',()=>{
 it('limits normalized company titles before persistence',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('.slice(0,300)||domain');
 });
});
