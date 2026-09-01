import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospecting provider boundaries',()=>{
 it('uses Firecrawl for discovery and leaves Browserbase and AgentMail out of the service',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("from './firecrawl.js'");
  expect(source.toLowerCase()).not.toContain('browserbase');
  expect(source.toLowerCase()).not.toContain('agentmail');
 });
});
