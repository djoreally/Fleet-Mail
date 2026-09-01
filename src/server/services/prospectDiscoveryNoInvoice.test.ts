import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery financial boundary',()=>{
 it('does not create invoices, quotes, or payments',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research(')).toLowerCase();
  for(const word of ['invoice','payment','quote']) expect(discover).not.toContain(word);
 });
});
