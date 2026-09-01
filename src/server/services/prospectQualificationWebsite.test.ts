import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect research website requirement',()=>{
 it('requires a canonical prospect website before Firecrawl research',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("if(!website)throw new Error('Prospect website is required for research')");
 });
});
