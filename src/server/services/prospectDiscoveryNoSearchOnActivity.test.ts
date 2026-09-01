import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect activity side effects',()=>{
 it('does not call Firecrawl while manually logging an activity',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const activity=source.slice(source.indexOf('async addActivity('),source.indexOf('async discover('));
  expect(activity).not.toContain('searchWeb(');
  expect(activity).not.toContain('crawlWebsite(');
 });
});
