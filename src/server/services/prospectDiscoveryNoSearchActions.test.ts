import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl search adapter action boundary',()=>{
 it('does not perform interactive browser actions',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8').then(x=>x.toLowerCase());
  for(const action of ['click(', 'fill(', 'reorder']) expect(source).not.toContain(action);
 });
});
