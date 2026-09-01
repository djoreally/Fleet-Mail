import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect research timestamp workflow',()=>{
 it('does not mark a prospect researched when it was only discovered',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).not.toContain('lastResearchedAt');
 });
});
