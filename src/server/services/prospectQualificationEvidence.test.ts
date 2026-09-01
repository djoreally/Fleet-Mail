import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('fleet prospect qualification evidence',()=>{
 it('asks the model to score concrete fleet operating signals',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  for(const signal of ['company-owned vehicles','field crews','delivery/service routes','multiple locations','recurring maintenance need']) expect(source).toContain(signal);
 });
});
