import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery crawl boundary',()=>{
 it('does not crawl a discovered site until explicit research',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const discover=source.slice(source.indexOf('async discover('),source.indexOf('async research('));
  const research=source.slice(source.indexOf('async research('),source.indexOf('async convertToFleetAccount('));
  expect(discover).not.toContain('crawlWebsite(');
  expect(research).toContain('crawlWebsite(website)');
 });
});
