import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Browserbase prospecting boundary docs',()=>{
 it('reserves Browserbase for explicit interactive workflows',async()=>{
  const doc=await readFile(new URL('../../../docs/prospect-discovery.md',import.meta.url),'utf8');
  expect(doc).toContain('explicit interactive browsing');
  expect(doc).toContain('filling forms or reordering supplies');
 });
});
