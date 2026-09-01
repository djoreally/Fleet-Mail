import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('explicit prospect research',()=>{
 it('keeps research behind its own API route',async()=>{
  const routes=await readFile(new URL('../routes/prospecting.ts',import.meta.url),'utf8');
  expect(routes).toContain("post('/prospects/:id/research'");
  expect(routes).toContain("post('/prospects/discover'");
 });
});
