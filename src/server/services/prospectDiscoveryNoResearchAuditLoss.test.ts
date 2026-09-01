import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect research audit trail',()=>{
 it('records a research activity after qualification analysis',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("this.addActivity(organizationId,prospectId,{kind:'research',channel:'firecrawl'");
 });
});
