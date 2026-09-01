import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery map directory rejection',()=>{
 it('does not use MapQuest as a canonical company website',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('mapquest.com');
 });
});
