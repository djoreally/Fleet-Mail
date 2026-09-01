import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('default discovery search intent',()=>{
 it('targets fleet vehicle companies instead of generic local businesses',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('fleet vehicles company');
 });
});
