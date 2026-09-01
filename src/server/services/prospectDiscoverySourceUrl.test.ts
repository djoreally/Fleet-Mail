import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('discovery source URL',()=>{
 it('retains the originating public result URL',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('sourceUrl:result.url');
 });
});
