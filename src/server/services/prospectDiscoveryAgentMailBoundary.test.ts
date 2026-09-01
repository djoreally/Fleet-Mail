import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospecting outreach boundary',()=>{
 it('does not send AgentMail during discovery',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source.toLowerCase()).not.toContain('agentmail');
  const doc=await readFile(new URL('../../../docs/prospect-discovery.md',import.meta.url),'utf8');
  expect(doc).toContain('AgentMail: outreach and reply workflows after a prospect is qualified.');
 });
});
