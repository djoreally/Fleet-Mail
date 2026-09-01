import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery dedupe ordering',()=>{
 it('checks the domain before calling canonical create',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover.indexOf('known.has(domain)')).toBeLessThan(discover.indexOf('this.create(organizationId'));
 });
});
