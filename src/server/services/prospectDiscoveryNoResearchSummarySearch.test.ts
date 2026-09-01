import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect research summary workflow',()=>{
 it('does not treat a search snippet as a research summary',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).not.toContain('researchSummary:');
  expect(discover).toContain('discoveryDescription:result.description');
 });
});
