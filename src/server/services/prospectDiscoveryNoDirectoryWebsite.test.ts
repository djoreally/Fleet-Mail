import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('directory website safety',()=>{
 it('filters directory hosts before canonical website persistence',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover.indexOf('BLOCKED_HOSTS.has(domain)')).toBeLessThan(discover.indexOf('cleanWebsite(result.url)'));
 });
});
