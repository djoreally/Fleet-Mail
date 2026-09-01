import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl search adapter layering',()=>{
 it('contains no database access',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).not.toContain('getDb');
  expect(source).not.toContain('drizzle');
  expect(source).not.toContain('DATABASE_URL');
 });
});
