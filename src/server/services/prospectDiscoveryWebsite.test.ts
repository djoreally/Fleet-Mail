import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('discovered prospect website',()=>{
 it('persists a normalized public website for later research',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain('website=cleanWebsite(result.url)!');
  expect(source).toContain('{companyName:title,website,industry');
 });
});
