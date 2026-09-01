import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect research conversion fields',()=>{
 it('does not assign conversion identifiers during website qualification',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const research=source.slice(source.indexOf('async research('),source.indexOf('async convertToFleetAccount('));
  expect(research).not.toContain('convertedCustomerId');
  expect(research).not.toContain('convertedAt');
 });
});
