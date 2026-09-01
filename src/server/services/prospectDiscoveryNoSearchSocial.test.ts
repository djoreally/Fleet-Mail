import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery social rejection',()=>{
 it('includes major social networks in blocked hosts',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  for(const host of ['facebook.com','instagram.com','linkedin.com','youtube.com']) expect(source).toContain(host);
 });
});
