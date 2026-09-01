import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect research customer boundary',()=>{
 it('does not create a Fleet Account until explicit conversion',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const research=source.slice(source.indexOf('async research('),source.indexOf('async convertToFleetAccount('));
  expect(research).not.toContain('customers');
  expect(research).not.toContain('customerId');
 });
});
