import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('qualification conversion separation',()=>{
 it('keeps convertToFleetAccount as a separate service method',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('async research(');
  expect(source).toContain('async convertToFleetAccount(');
 });
});
