import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery tenancy',()=>{
 it('creates discovered prospects through the organization-scoped service',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('this.create(organizationId');
  expect(source).toContain('this.list(organizationId)');
 });
});
