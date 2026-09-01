import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect fleet size workflow',()=>{
 it('does not infer fleet size during search discovery',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).not.toContain('estimatedFleetSize:');
  expect(source).toContain('Do not invent fleet size; use null when unsupported.');
 });
});
