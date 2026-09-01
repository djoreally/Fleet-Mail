import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('prospect discovery schema reuse',()=>{
 it('uses the canonical prospects table rather than adding a parallel lead model',async()=>{
  const source=await readFile(new URL('./prospecting.ts',import.meta.url),'utf8');
  expect(source).toContain("import { prospectActivities, prospectContacts, prospects } from '../../db/prospectSchema.js'");
  expect(source.toLowerCase()).not.toContain('leadstable');
 });
});
