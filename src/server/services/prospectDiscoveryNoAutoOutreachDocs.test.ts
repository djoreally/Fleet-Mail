import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery workflow docs',()=>{
 it('keeps discovery and qualification separate from outreach',async()=>{
  const doc=await readFile(new URL('../../../docs/prospect-discovery.md',import.meta.url),'utf8');
  expect(doc.indexOf('## Discovery')).toBeLessThan(doc.indexOf('## Qualification'));
  expect(doc).toContain('after a prospect is qualified');
 });
});
