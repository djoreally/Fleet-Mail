import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery input scope',()=>{
 it('accepts business geography, industry, query, and limit rather than personal targeting fields',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  for(const field of ['location','industry','query','limit']) expect(discover).toContain(`input.${field}`);
  for(const field of ['ssn','birth','race','religion']) expect(discover.toLowerCase()).not.toContain(field);
 });
});
