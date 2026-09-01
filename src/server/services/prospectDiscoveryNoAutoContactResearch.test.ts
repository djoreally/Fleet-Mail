import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect contact creation workflow',()=>{
 it('keeps contact creation behind its explicit endpoint',async()=>{
  const routes=await readFile(new URL('../routes/prospecting.ts',import.meta.url),'utf8');
  expect(routes).toContain("post('/prospects/:id/contacts'");
 });
});
