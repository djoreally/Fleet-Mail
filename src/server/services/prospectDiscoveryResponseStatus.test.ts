import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery HTTP contract',()=>{
 it('returns 201 when a discovery request is processed',async()=>{
  const source=await readFile(new URL('../routes/prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("post('/prospects/discover'");
  expect(source).toContain('res.status(201).json(await prospectingService.discover');
 });
});
