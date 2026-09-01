import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery email boundary',()=>{
 it('contains no mail-send operation',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research(')).toLowerCase();
  expect(discover).not.toContain('mail');
  expect(discover).not.toContain('email:');
 });
});
