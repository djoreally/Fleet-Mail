import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('operational RBAC hardening', () => {
  it('separates work-order reads, management, and technician execution', () => {
    const route = readFileSync('src/server/routes/operations.ts', 'utf8');
    expect(route).toContain("requireFleetPermission(req, 'work_orders.view')");
    expect(route).toContain("requireFleetPermission(req, 'work_orders.manage')");
    expect(route).toContain("requireFleetPermission(req, 'work_orders.execute')");
  });

  it('requires schedule and dispatch permissions for each mutation surface', () => {
    const route = readFileSync('src/server/routes/scheduleDispatch.ts', 'utf8');
    expect(route).toContain("requireFleetPermission(req, 'schedule.view')");
    expect(route).toContain("requireFleetPermission(req, 'schedule.manage')");
    expect(route).toContain("requireFleetPermission(req, 'dispatch.view')");
    expect(route).toContain("requireFleetPermission(req, 'dispatch.manage')");
  });

  it('requires agent authority and the target domain permission before execution', () => {
    const route = readFileSync('src/server/routes/agentActions.ts', 'utf8');
    expect(route).toContain("requireFleetPermission(req, 'agent.execute')");
    expect(route).toContain("requireFleetPermission(req, 'inbox.send')");
    expect(route).toContain("requireFleetPermission(req, 'schedule.manage')");
    expect(route).toContain("requireFleetPermission(req, 'work_orders.manage')");
    expect(route).toContain("requireFleetPermission(req, 'authorizations.manage')");
    expect(route).toContain("requireFleetPermission(req, 'prospects.manage')");
  });
});
