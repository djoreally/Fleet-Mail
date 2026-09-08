import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Fleet and revenue completion contract', () => {
  it('makes Vehicle 360 reachable from Fleet Account 360', () => {
    const account = readFileSync('src/components/operations/FleetAccount360Drawer.tsx', 'utf8');
    const vehicle = readFileSync('src/components/operations/Vehicle360Drawer.tsx', 'utf8');
    const api = readFileSync('src/components/operations/operationsApi.ts', 'utf8');
    expect(account).toContain('Vehicle360Drawer');expect(account).toContain('Open Vehicle 360');expect(vehicle).toContain('Cached service specifications');expect(vehicle).toContain('Preventive maintenance');expect(api).toContain('/api/vehicles/');
  });
  it('renders acquisition provenance in Fleet Account 360', () => {const account=readFileSync('src/components/operations/FleetAccount360Drawer.tsx','utf8');expect(account).toContain('Acquisition history');expect(account).toContain('data.revenueHistory');});
  it('requires a signed confirmation before prospect conversion', () => {
    const routes=readFileSync('src/server/routes/prospecting.ts','utf8');const actions=readFileSync('src/server/routes/agentActions.ts','utf8');
    expect(routes).toContain("createAgentActionProposal('fleet.prospect.convert'");expect(routes).not.toContain('return res.json(await prospectingService.convertToFleetAccount');expect(/proposal\.kind\s*===\s*['\"]fleet\.prospect\.convert['\"]/.test(actions)).toBe(true);expect(actions).toContain('verifyAgentActionProposal');
  });
  it('marks webhook and manual inbox replies for immediate follow-up', () => {expect(readFileSync('src/server/services/prospectWebhook.ts','utf8')).toContain('nextFollowUpAt:new Date()');expect(readFileSync('src/server/services/prospectInboxSync.ts','utf8')).toContain('nextFollowUpAt:new Date()');});
});
