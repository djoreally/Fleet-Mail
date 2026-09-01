import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firecrawl result filtering',()=>{
 it('filters normalized search results before discovery consumes them',async()=>{
  const source=await readFile(new URL('./firecrawl.ts',import.meta.url),'utf8');
  expect(source).toContain(".filter((row: SearchResult) => /^https:\\/\\//i.test(row.url))");
 });
});
