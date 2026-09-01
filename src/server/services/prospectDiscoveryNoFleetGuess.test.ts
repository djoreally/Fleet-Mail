import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('discovery fleet-size safety',()=>{
 it('does not infer fleet size from search snippets',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).not.toContain('estimatedFleetSize:');
 });
});
