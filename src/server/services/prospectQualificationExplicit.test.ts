import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('explicit qualification workflow',()=>{
 it('keeps qualification behind the research endpoint rather than discovery',async()=>{
  const routes=await readFile(new URL('../routes/prospecting.ts',import.meta.url),'utf8');
  expect(routes).toContain('prospectingService.research(org,req.params.id)');
  expect(routes).toContain('prospectingService.discover(org,req.body??{})');
 });
});
