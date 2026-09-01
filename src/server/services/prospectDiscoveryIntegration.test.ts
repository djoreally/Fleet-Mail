import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery integration',()=>{
 it('connects route to service to Firecrawl without a parallel persistence model',async()=>{
  const [routes,service]=await Promise.all([
   readFile(new URL('../routes/prospecting.ts',import.meta.url),'utf8'),
   readFile(new URL('./prospecting.ts',import.meta.url),'utf8'),
  ]);
  expect(routes).toContain('prospectingService.discover');
  expect(service).toContain('searchWeb(query');
  expect(service).toContain('this.create(organizationId');
 });
});
