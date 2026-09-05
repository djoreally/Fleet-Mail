import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Fleet Agent customer onboarding and mobile mutation hardening',()=>{
  const loop=readFileSync('src/server/services/fleetAgentLoop.ts','utf8');
  const actions=readFileSync('src/server/services/agentActions.ts','utf8');
  const route=readFileSync('src/server/routes/agentActions.ts','utf8');
  const onboarding=readFileSync('src/server/services/fleetCustomerMutations.ts','utf8');
  const app=readFileSync('src/App.tsx','utf8');
  const parts=readFileSync('src/components/operations/PartsWorkspace.tsx','utf8');

  it('exposes confirmation-gated Fleet account, contact, vehicle, and composite onboarding tools',()=>{
    expect(loop).toContain("create_fleet_account: 'fleet.account.create'");
    expect(loop).toContain("create_fleet_contact: 'fleet.contact.create'");
    expect(loop).toContain("add_fleet_vehicle: 'fleet.vehicle.create'");
    expect(loop).toContain("onboard_fleet_customer: 'fleet.customer.onboard'");
    expect(actions).toContain("| 'fleet.customer.onboard'");
    expect(route).toContain("proposal.kind === 'fleet.customer.onboard'");
    expect(route).toContain("requireFleetPermission(req, 'fleet_accounts.manage')");
    expect(route).toContain("requireFleetPermission(req, 'vehicles.manage')");
  });

  it('keeps onboarding tenant-scoped, transactional, and duplicate-aware',()=>{
    expect(onboarding).toContain("await client.query('BEGIN')");
    expect(onboarding).toContain("await client.query('ROLLBACK')");
    expect(onboarding).toContain('WHERE organization_id=$1');
    expect(onboarding).toContain('already belongs to another Fleet account');
    expect(onboarding).toContain('customer_id=$3');
  });

  it('never renders an empty successful agent turn and returns grounded execution feedback',()=>{
    expect(loop).toContain('visibleContent');
    expect(loop).toContain('Nothing was changed.');
    expect(route).toContain('message: executionMessage(proposal, result)');
    expect(app).toContain("content: cleaned || fallback");
    expect(app).toContain("content: String(body.message || 'The confirmed action was completed successfully.')");
  });

  it('carries workspace-mode headers through chat and confirmed action requests',()=>{
    expect(app).toContain("fleetFetch('/api/chat'");
    expect(app).toContain("fleetFetch('/api/agent/actions/execute'");
    expect(app).not.toContain("fetch('/api/agent/actions/execute'");
  });

  it('uses an in-app mobile-safe part deletion confirmation that actually dispatches DELETE',()=>{
    expect(parts).toContain('setDeleteTarget(r)');
    expect(parts).toContain('await operationsApi.deletePart(deleteTarget.id)');
    expect(parts).toContain('role="dialog"');
    expect(parts).not.toContain("window.confirm('Delete this part");
  });
});
