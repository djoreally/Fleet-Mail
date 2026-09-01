import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery table model',()=>{
 it('does not introduce a separate discovered-prospects table',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).not.toContain('discoveredProspects');
  expect(source).not.toContain('prospectLeads');
 });
});
