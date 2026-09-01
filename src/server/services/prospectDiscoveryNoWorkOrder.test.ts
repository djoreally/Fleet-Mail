import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery operations boundary',()=>{
 it('does not create work orders or schedule operations',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research(')).toLowerCase();
  expect(discover).not.toContain('workorder');
  expect(discover).not.toContain('schedule');
 });
});
