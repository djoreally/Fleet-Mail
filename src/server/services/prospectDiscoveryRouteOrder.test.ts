import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect route ordering',()=>{
 it('declares discover before /:id so Express cannot consume discover as an id',async()=>{
  const source=await readFile(new URL('../routes/prospecting.ts',import.meta.url),'utf8');
  expect(source.indexOf("'/prospects/discover'")).toBeLessThan(source.indexOf("'/prospects/:id'"));
 });
});
