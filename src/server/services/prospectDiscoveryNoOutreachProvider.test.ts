import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('discovery outreach provider boundary',()=>{
 it('does not import or invoke email services while finding prospects',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source.toLowerCase()).not.toContain("from './agentmail");
  expect(source.toLowerCase()).not.toContain('sendemail');
 });
});
