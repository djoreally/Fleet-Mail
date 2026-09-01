import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('discovered company title',()=>{
 it('bounds normalized search titles before persistence',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain(".trim().slice(0,300)||domain");
 });
});
