import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery dependencies',()=>{
 it('uses the existing Firecrawl service without a new prospect data package',async()=>{
  const pkg=await readFile(new URL('../../../package.json',import.meta.url),'utf8');
  for(const provider of ['apollo','clearbit','zoominfo','hunter']) expect(pkg.toLowerCase()).not.toContain(provider);
 });
});
