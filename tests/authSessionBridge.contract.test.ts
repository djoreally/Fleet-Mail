import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('sign-in session bridge',()=>{
  it('persists the Neon JWT before validating Fleet API access',()=>{
    const source=readFileSync('src/components/auth/SignInPage.tsx','utf8');
    const tokenIndex=source.indexOf('const token = await neon.auth.getJWTToken()');
    const persistIndex=source.indexOf('setActiveNeonAuthSession(token, null)');
    const accessIndex=source.indexOf("fleetFetch('/api/access')");
    expect(tokenIndex).toBeGreaterThan(-1);
    expect(persistIndex).toBeGreaterThan(tokenIndex);
    expect(accessIndex).toBeGreaterThan(persistIndex);
  });

  it('clears a partial Fleet session when sign-in validation fails',()=>{
    const source=readFileSync('src/components/auth/SignInPage.tsx','utf8');
    expect(source).toContain('setActiveNeonAuthSession(null, null)');
  });
});
