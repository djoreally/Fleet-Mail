import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery database safety',()=>{
 it('contains no DDL or migration execution',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research(')).toLowerCase();
  for(const ddl of ['create table','alter table','drop table','migration']) expect(discover).not.toContain(ddl);
 });
});
