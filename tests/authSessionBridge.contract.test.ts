import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('sign-in session bridge',()=>{
  it('persists the Neon JWT before validating Fleet API access',()=>{
    const source=readFileSync('src/components/auth/SignInPage.tsx','utf8');
    const signInIndex=source.indexOf('neonAuth.adapter.signIn.email');
    const tokenIndex=source.indexOf('const token = await neonAuth.getJWTToken()');
    const persistIndex=source.indexOf('setActiveNeonAuthSession(token, null)');
    const accessIndex=source.indexOf("fleetFetch('/api/access')");
    expect(signInIndex).toBeGreaterThan(-1);
    expect(tokenIndex).toBeGreaterThan(signInIndex);
    expect(persistIndex).toBeGreaterThan(tokenIndex);
    expect(accessIndex).toBeGreaterThan(persistIndex);
  });

  it('restores the same JWT bearer bridge instead of persisting the opaque Better Auth session token',()=>{
    const source=readFileSync('src/components/AppShell.tsx','utf8');
    expect(source).toContain("import { neon, neonAuth } from '../lib/neon'");
    expect(source).toContain('const jwt = nextSession ? await neonAuth.getJWTToken() : null');
    expect(source).toContain('setActiveNeonAuthSession(jwt, nextUser)');
    expect(source).not.toContain('sessionToken(nextSession)');
  });

  it('clears partial and signed-out Fleet bearer state',()=>{
    const signIn=readFileSync('src/components/auth/SignInPage.tsx','utf8');
    const shell=readFileSync('src/components/AppShell.tsx','utf8');
    expect(signIn).toContain('setActiveNeonAuthSession(null, null)');
    expect(shell).toContain('setActiveNeonAuthSession(null, null)');
  });
});
