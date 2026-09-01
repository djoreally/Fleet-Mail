import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect research outreach boundary',()=>{
 it('does not send AgentMail while qualifying a prospect',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source.toLowerCase()).not.toContain('agentmail');
 });
});
