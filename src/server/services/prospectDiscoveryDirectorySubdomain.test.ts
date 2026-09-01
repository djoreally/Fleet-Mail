import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('directory domain filtering',()=>{
 it('filters both exact directory hosts and their subdomains',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("domain.endsWith(`.${x}`)");
 });
});
