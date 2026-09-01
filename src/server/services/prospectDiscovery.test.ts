import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery route contract',()=>{
 it('exposes organization-scoped discovery before the dynamic prospect route',async()=>{
  const source=await readFile(new URL('../routes/prospecting.ts',import.meta.url),'utf8');
  const discovery=source.indexOf("post('/prospects/discover'");
  const dynamic=source.indexOf("get('/prospects/:id'");
  expect(discovery).toBeGreaterThan(-1);
  expect(dynamic).toBeGreaterThan(discovery);
  expect(source).toContain('requireFleetOrganization(req)');
  expect(source).toContain('prospectingService.discover');
 });
});
