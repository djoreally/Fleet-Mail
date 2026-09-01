import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('deterministic prospect discovery',()=>{
 it('does not use the AI completion service to choose search-result candidates',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).not.toContain('callAICompletion(');
 });
});
