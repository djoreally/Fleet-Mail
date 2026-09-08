import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const hasPermission=(source:string,permission:string)=>new RegExp(`requireFleetPermission\\(req,\\s*['\"]${permission}['\"]\\)`).test(source);

describe('operational RBAC hardening', () => {
  it('separates work-order reads, management, and technician execution', () => {
    const route = readFileSync('src/server/routes/operations.ts', 'utf8');
    expect(hasPermission(route,'work_orders.view')).toBe(true);
    expect(hasPermission(route,'work_orders.manage')).toBe(true);
    expect(hasPermission(route,'work_orders.execute')).toBe(true);
  });
  it('requires schedule and dispatch permissions for each mutation surface', () => {
    const route = readFileSync('src/server/routes/scheduleDispatch.ts', 'utf8');
    expect(hasPermission(route,'schedule.view')).toBe(true);
    expect(hasPermission(route,'schedule.manage')).toBe(true);
    expect(hasPermission(route,'dispatch.view')).toBe(true);
    expect(hasPermission(route,'dispatch.manage')).toBe(true);
  });
  it('requires agent authority and target-domain permissions before execution', () => {
    const route = readFileSync('src/server/routes/agentActions.ts', 'utf8');
    for(const permission of ['agent.execute','inbox.send','schedule.manage','dispatch.manage','work_orders.manage','authorizations.manage','prospects.manage','fleet_accounts.manage','vehicles.manage'])expect(hasPermission(route,permission)).toBe(true);
  });
});
