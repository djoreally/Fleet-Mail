import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect research company focus',()=>{
 it('asks for company fleet intelligence rather than personal contact data',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const research=source.slice(source.indexOf('async research('),source.indexOf('async convertToFleetAccount('));
  expect(research).toContain('industry (string|null)');
  expect(research).toContain('estimatedFleetSize (integer|null)');
  expect(research).not.toContain('contactName');
  expect(research).not.toContain('contactEmail');
 });
});
