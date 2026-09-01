import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery tenant boundary',()=>{
 it('does not accept organizationId from the request payload',async()=>{
  const route=await readFile(new URL('../routes/prospecting.ts',import.meta.url),'utf8');
  const line=route.split('\n').find(row=>row.includes("'/prospects/discover'"))||'';
  expect(line).toContain('requireFleetOrganization(req)');
  expect(line).toContain('prospectingService.discover(org,req.body??{})');
  expect(line).not.toContain('req.body.organizationId');
 });
});
