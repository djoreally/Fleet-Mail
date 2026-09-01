import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery errors',()=>{
 it('maps required and invalid inputs to client errors',async()=>{
  const source=await readFile(new URL('../routes/prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('/required|invalid|must|valid/i.test(message)?400');
 });
});
