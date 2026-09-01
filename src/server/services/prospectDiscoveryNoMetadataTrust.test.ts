import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('search metadata trust boundary',()=>{
 it('stores search description in metadata while research owns fleet evidence',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).toContain('discoveryDescription:result.description');
  expect(discover).not.toContain('fleetEvidence:');
 });
});
