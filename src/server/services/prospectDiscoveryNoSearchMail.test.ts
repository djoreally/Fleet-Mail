import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl search adapter mail boundary',()=>{
 it('contains no AgentMail calls',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source.toLowerCase()).not.toContain('agentmail');
 });
});
