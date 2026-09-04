import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Fleet OS workforce foundation', () => {
  const team = readFileSync('src/server/routes/team.ts', 'utf8');
  const auth = readFileSync('src/server/services/fleetAuth.ts', 'utf8');
  const sidebar = readFileSync('src/components/Sidebar.tsx', 'utf8');
  const home = readFileSync('src/components/public/HomePage.tsx', 'utf8');
  const migration = readFileSync('src/db/migrations/0005_team_invitations.sql', 'utf8');

  it('keeps invitations in Fleet OS while Neon Auth remains the identity provider', () => {
    expect(team).toContain("requireFleetPermission(req, 'team.manage')");
    expect(team).toContain("new Set<FleetRole>(['admin', 'dispatcher', 'technician', 'viewer'])");
    expect(team).toContain('Owner role cannot be assigned here');
    expect(auth).toContain('x-fleet-invite-token');
    expect(auth).toContain("createHash('sha256')");
    expect(auth).toContain('Invitation email does not match the signed-in user');
  });

  it('creates a technician profile when a technician invitation is accepted', () => {
    expect(auth).toContain("role==='technician'");
    expect(auth).toContain('INSERT INTO technicians');
  });

  it('keeps invitation secrets backend-only', () => {
    expect(migration).toContain('REVOKE ALL ON public.organization_invitations FROM PUBLIC');
    expect(migration).toContain('token_hash text NOT NULL');
    expect(migration).not.toContain('token text NOT NULL');
  });

  it('makes navigation permission-aware without replacing server authorization', () => {
    expect(sidebar).toContain("fleetFetch('/api/access')");
    expect(sidebar).toContain("permission:'financials.view'");
    expect(sidebar).toContain("permission:'agent.use'");
    expect(sidebar).toContain('Fleet Agent');
  });

  it('markets the ultimate operating loop without claiming live mileage telemetry', () => {
    expect(home).toContain('From first fleet email to final payment');
    expect(home).toContain('Manual');
    expect(home).toContain('Assisted');
    expect(home).toContain('Autopilot');
    expect(home).toContain('NHTSA');
    expect(home.toLowerCase()).not.toContain('odometer');
    expect(home.toLowerCase()).not.toContain('smartcar');
  });
});
