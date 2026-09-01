import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('business-focused prospect discovery',()=>{
 it('stores company-level search data only',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  expect(discover).toContain('companyName:title');
  expect(discover).toContain('website');
  expect(discover).not.toContain('Contact name');
 });
});
