import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect research conversion boundary',()=>{
 it('does not invoke Fleet Account conversion while researching',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const research=source.slice(source.indexOf('async research('),source.indexOf('async convertToFleetAccount('));
  expect(research).not.toContain('convertToFleetAccount(');
 });
});
