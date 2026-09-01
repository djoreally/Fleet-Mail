import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery outreach safety',()=>{
 it('does not send messages or create outreach activities during discovery',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).not.toContain('addActivity(');
  expect(discover).not.toContain('send');
 });
});
