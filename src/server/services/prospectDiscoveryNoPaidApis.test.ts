import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery provider scope',()=>{
 it('does not introduce third-party paid prospect databases',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  for(const provider of ['apollo','clearbit','zoominfo','hunter.io','people data labs']) expect(source.toLowerCase()).not.toContain(provider);
 });
});
