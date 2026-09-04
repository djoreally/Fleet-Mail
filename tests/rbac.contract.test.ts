import { describe, expect, it } from 'vitest';
import { fleetRoleHasPermission, normalizeFleetRole, permissionsForRole } from '../src/server/services/rbac.js';

describe('Fleet OS RBAC foundation', () => {
  it('normalizes legacy and shorthand roles without granting extra authority', () => {
    expect(normalizeFleetRole('dispatch')).toBe('dispatcher');
    expect(normalizeFleetRole('tech')).toBe('technician');
    expect(normalizeFleetRole('member')).toBe('viewer');
    expect(normalizeFleetRole('unknown-role')).toBe('viewer');
  });

  it('keeps infrastructure and team administration owner/admin only', () => {
    expect(fleetRoleHasPermission('owner', 'infrastructure.manage')).toBe(true);
    expect(fleetRoleHasPermission('admin', 'infrastructure.manage')).toBe(true);
    expect(fleetRoleHasPermission('dispatcher', 'infrastructure.manage')).toBe(false);
    expect(fleetRoleHasPermission('technician', 'team.manage')).toBe(false);
    expect(fleetRoleHasPermission('viewer', 'team.manage')).toBe(false);
  });

  it('gives dispatchers operational control without owner authority', () => {
    expect(fleetRoleHasPermission('dispatcher', 'schedule.manage')).toBe(true);
    expect(fleetRoleHasPermission('dispatcher', 'dispatch.manage')).toBe(true);
    expect(fleetRoleHasPermission('dispatcher', 'work_orders.manage')).toBe(true);
    expect(fleetRoleHasPermission('dispatcher', 'organization.manage')).toBe(false);
    expect(fleetRoleHasPermission('dispatcher', 'settings.manage')).toBe(false);
  });

  it('keeps technicians constrained to assigned-work capabilities at the permission layer', () => {
    expect(fleetRoleHasPermission('technician', 'work_orders.execute')).toBe(true);
    expect(fleetRoleHasPermission('technician', 'inspections.execute')).toBe(true);
    expect(fleetRoleHasPermission('technician', 'dispatch.manage')).toBe(false);
    expect(fleetRoleHasPermission('technician', 'financials.view')).toBe(false);
    expect(fleetRoleHasPermission('technician', 'agent.execute')).toBe(false);
  });

  it('exposes a deterministic permission set for client-side navigation without making UI the security boundary', () => {
    const permissions = permissionsForRole('viewer');
    expect(permissions).toContain('fleet_accounts.view');
    expect(permissions).toContain('vehicles.view');
    expect(permissions).not.toContain('vehicles.manage');
  });
});
