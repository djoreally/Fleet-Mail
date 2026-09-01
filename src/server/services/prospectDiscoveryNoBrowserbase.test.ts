import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospecting browser policy',()=>{
 it('documents Browserbase as interactive-only',async()=>{
  const doc=await readFile(new URL('../../../docs/prospect-discovery.md',import.meta.url),'utf8');
  expect(doc).toContain('Browserbase: explicit interactive browsing');
  expect(doc).toContain('Discovery never invokes Browserbase');
 });
});
