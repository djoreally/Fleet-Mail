import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery execution',()=>{
 it('keeps discovery deterministic and search-only before explicit research',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).toContain('searchWeb(');
  expect(discover).not.toContain('callAICompletion(');
 });
});
