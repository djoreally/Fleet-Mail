import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Fleetmail V1 release chain', () => {
  const prospecting = readFileSync('src/server/routes/prospecting.ts', 'utf8');
  const fleetService = readFileSync('src/server/routes/fleetService.ts', 'utf8');
  const vehicles = readFileSync('src/server/routes/vehicleManagement.ts', 'utf8');
  const operations = readFileSync('src/server/routes/operations.ts', 'utf8');
  const dispatch = readFileSync('src/server/routes/scheduleDispatch.ts', 'utf8');
  const execution = readFileSync('src/server/routes/workOrderExecution.ts', 'utf8');
  const completion = readFileSync('src/server/routes/workOrderCompletion.ts', 'utf8');
  const prospectsUi = readFileSync('src/components/operations/ProspectCommandCenter.tsx', 'utf8');
  const accountsUi = readFileSync('src/components/operations/FleetAccountsCertifiedWorkspace.tsx', 'utf8');
  const techUi = readFileSync('src/components/operations/TechnicianWorkspace.tsx', 'utf8');
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));

  it('keeps prospect research, outreach, confirmation-gated send and conversion connected', () => {
    expect(prospecting).toContain("post('/prospects/:id/research'");
    expect(prospecting).toContain("post('/prospects/:id/outreach/draft'");
    expect(prospecting).toContain("createAgentActionProposal('email.send'");
    expect(prospecting).toContain("post('/prospects/:id/convert'");
    expect(prospecting).toContain("createAgentActionProposal('fleet.prospect.convert'");
    expect(prospectsUi).toContain("'/api/agent/actions/execute'");
    expect(prospectsUi).toContain('Confirm and send with AgentMail');
    expect(prospectsUi).toContain('Convert to Fleet Account');
  });

  it('keeps Fleet Account onboarding parent-bound from agreement through first vehicle', () => {
    expect(fleetService).toContain("post('/accounts/:customerId/agreements'");
    expect(fleetService).toContain("post('/accounts/:customerId/vehicles'");
    expect(accountsUi).toContain('/api/fleet-service/accounts/${encodeURIComponent(accountId)}/agreements');
    expect(accountsUi).toContain('/api/fleet-service/accounts/${encodeURIComponent(accountId)}/vehicles');
    expect(accountsUi).toContain('Save agreement & continue');
  });

  it('keeps vehicle, work-order and dispatch creation mounted', () => {
    expect(vehicles).toContain("post('/vehicles'");
    expect(operations).toContain("post('/work-orders'");
    expect(dispatch).toContain("post('/dispatch'");
    expect(dispatch).toContain("patch('/dispatch/:id/status'");
  });

  it('keeps technician inspection, authorization, service and validated completion connected', () => {
    expect(execution).toContain("get('/work-orders/:id/execution'");
    expect(execution).toContain("post('/work-orders/:id/inspections'");
    expect(execution).toContain("post('/inspections/:id/items'");
    expect(execution).toContain("post('/work-orders/:id/authorizations'");
    expect(execution).toContain("post('/work-orders/:id/service-lines'");
    expect(completion).toContain("post('/work-orders/:id/complete-validated'");
    expect(techUi).toContain('/api/operations/work-orders/${id}/execution');
    expect(techUi).toContain('/api/operations/work-orders/${selectedId}/inspections');
    expect(techUi).toContain('/api/operations/work-orders/${selectedId}/authorizations');
    expect(techUi).toContain('/api/operations/work-orders/${selectedId}/service-lines');
    expect(techUi).toContain('/api/operations/work-orders/${selectedId}/complete-validated');
  });

  it('keeps Vercel splat rewrites for every deep API namespace used by the V1 chain', () => {
    for (const prefix of ['operations','fleet-service','fleet-operations','agent']) {
      expect(vercel.rewrites).toContainEqual({
        source: `/api/${prefix}/:path*`,
        destination: `/api/${prefix}/[...path]`,
      });
    }
  });
});
