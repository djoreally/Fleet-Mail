import { describe, expect, it } from 'vitest';
import { readdir } from 'node:fs/promises';

describe('prospect discovery persistence',()=>{
 it('does not require a new migration for discovery',async()=>{
  const files=await readdir(new URL('../../../drizzle/',import.meta.url));
  expect(files.filter(name=>name.endsWith('.sql')).length).toBeGreaterThan(0);
  expect(files.some(name=>/discovery/i.test(name))).toBe(false);
 });
});
