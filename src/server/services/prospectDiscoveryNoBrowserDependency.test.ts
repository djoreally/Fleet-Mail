import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery browser dependency',()=>{
 it('does not require a Browserbase SDK for discovery',async()=>{
  const pkg=await readFile(new URL('../../../package.json',import.meta.url),'utf8');
  expect(pkg.toLowerCase()).not.toContain('browserbase');
 });
});
