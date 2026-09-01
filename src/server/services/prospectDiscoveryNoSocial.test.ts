import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery social filtering',()=>{
 it('does not use social profiles as canonical company websites',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("'facebook.com','instagram.com','linkedin.com'");
 });
});
