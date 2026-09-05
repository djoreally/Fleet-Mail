import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('role workspace Vercel API routing',()=>{
  it('ships dedicated Vercel catch-all functions for Technician and Dispatcher APIs',()=>{
    const technician=readFileSync('api/technician/[...path].ts','utf8');
    const dispatcher=readFileSync('api/dispatcher/[...path].ts','utf8');
    for(const source of [technician,dispatcher]){
      expect(source).toContain("import { createApp } from '../../src/server/app.js'");
      expect(source).toContain('export default createApp()');
    }
  });
});
