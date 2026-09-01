import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery enrichment boundary',()=>{
 it('keeps website enrichment in the explicit research method',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).not.toContain('crawlWebsite(');
  expect(discover).not.toContain('callAICompletion(');
 });
});
