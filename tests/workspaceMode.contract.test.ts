import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Fleet workspace-mode login contract',()=>{
  const auth=readFileSync('src/server/services/fleetAuth.ts','utf8');
  const client=readFileSync('src/lib/fleetApi.ts','utf8');
  const signIn=readFileSync('src/components/auth/SignInPage.tsx','utf8');

  it('keeps the canonical membership role separate from the selected workspace role',()=>{
    expect(auth).toContain('fleetMembershipRole?: FleetRole');
    expect(auth).toContain('fleetEffectiveRole?: FleetRole');
    expect(auth).toContain("if(!['owner','admin'].includes(membershipRole))throw new FleetAuthError(403");
    expect(auth).toContain("if(!['dispatcher','technician'].includes(requested))throw new FleetAuthError(400");
    expect(auth).toContain('permissions:permissionsForRole(role)');
  });

  it('applies selected workspace mode to every same-origin Fleet API request',()=>{
    expect(client).toContain("const WORKSPACE_MODE_KEY = 'fleetos:workspace-mode'");
    expect(client).toContain("'x-fleet-workspace-mode': mode");
    expect(client).toContain('Object.entries(workspaceHeaders())');
  });

  it('shows dispatcher and technician choices on the sign-in screen and validates access before navigation',()=>{
    expect(signIn).toContain("label:'Dispatcher'");
    expect(signIn).toContain("label:'Technician'");
    expect(signIn).toContain("await fleetFetch('/api/access')");
    expect(signIn).toContain("'Sign in to Dispatcher OS'");
    expect(signIn).toContain("'Sign in to Technician OS'");
  });
});
