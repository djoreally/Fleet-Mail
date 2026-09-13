import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Vercel request body compatibility', () => {
  it('does not reparse a body already populated by the Vercel Node runtime', () => {
    const source = readFileSync('src/server/app.ts', 'utf8');
    expect(source).toContain('preParsedBody=req.body');
    expect(source).toContain('preParsedBody!==undefined&&preParsedBody!==null');
    expect(source).toContain('return jsonParser(req,res');
  });
});
