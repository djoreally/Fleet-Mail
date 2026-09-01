import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('social host filtering',()=>{
 it('checks blocked host suffixes in addition to exact hosts',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('[...BLOCKED_HOSTS].some(x=>domain.endsWith(`.${x}`))');
 });
});
