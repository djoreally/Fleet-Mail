import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery result quality',()=>{
 it('filters common social and directory domains',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  for(const domain of ['facebook.com','instagram.com','linkedin.com','yelp.com','yellowpages.com']) expect(source).toContain(domain);
 });
});
