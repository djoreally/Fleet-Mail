import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('discovery browser provider boundary',()=>{
 it('does not import Browserbase in prospect discovery or qualification',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source.toLowerCase()).not.toContain("from './browserbase");
 });
});
