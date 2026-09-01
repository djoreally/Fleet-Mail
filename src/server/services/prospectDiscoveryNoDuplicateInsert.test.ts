import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('within-run prospect dedupe',()=>{
 it('adds each inserted domain to the dedupe set before continuing',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover.indexOf('known.add(domain)')).toBeLessThan(discover.indexOf('created.push(row)'));
 });
});
