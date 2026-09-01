import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery search dependency',()=>{
 it('does not add a Google search SDK dependency',async()=>{
  const pkg=await readFile(new URL('../../../package.json',import.meta.url),'utf8');
  expect(pkg.toLowerCase()).not.toContain('googleapis');
  expect(pkg.toLowerCase()).not.toContain('places-api');
 });
});
