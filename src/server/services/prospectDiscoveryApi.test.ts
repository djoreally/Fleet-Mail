import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery API',()=>{
 it('passes only the authenticated organization and request payload into discovery',async()=>{
  const source=await readFile(new URL('../routes/prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('prospectingService.discover(org,req.body??{})');
 });
});
