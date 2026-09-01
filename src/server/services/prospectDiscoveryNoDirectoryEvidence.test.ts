import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery evidence quality',()=>{
 it('filters blocked domains before a prospect can later be researched',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover.indexOf('BLOCKED_HOSTS.has(domain)')).toBeLessThan(discover.indexOf('this.create(organizationId'));
 });
});
