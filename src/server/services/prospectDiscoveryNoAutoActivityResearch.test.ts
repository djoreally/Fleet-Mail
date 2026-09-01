import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect activity workflow',()=>{
 it('logs the completed research event without fabricating outreach events',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  const research=source.slice(source.indexOf('async research('),source.indexOf('async convertToFleetAccount('));
  expect(research).toContain("kind:'research'");
  expect(research).not.toContain("kind:'outreach'");
 });
});
