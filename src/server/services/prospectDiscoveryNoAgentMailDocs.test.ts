import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('AgentMail prospecting boundary docs',()=>{
 it('places AgentMail after qualification rather than discovery',async()=>{
  const doc=await readFile(new URL('../../../docs/prospect-discovery.md',import.meta.url),'utf8');
  expect(doc).toContain('AgentMail: outreach and reply workflows after a prospect is qualified.');
 });
});
