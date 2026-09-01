import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect conversion boundary',()=>{
 it('keeps Fleet Account conversion on a separate explicit route',async()=>{
  const routes=await readFile(new URL('../routes/prospecting.ts',import.meta.url),'utf8');
  expect(routes).toContain("post('/prospects/:id/convert'");
  expect(routes).toContain("post('/prospects/discover'");
 });
});
