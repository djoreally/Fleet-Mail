import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect research source retention',()=>{
 it('persists URLs and titles for researched evidence',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('const sources=evidence.map(p=>({url:p.url,title:p.title}))');
  expect(source).toContain('researchSources:sources');
 });
});
