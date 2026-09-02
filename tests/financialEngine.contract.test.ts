import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('financial engine contract', () => {
  it('scopes invoices, payments, service lines, parts, fluids, and work orders to one organization', () => {
    const source = readFileSync('src/server/services/financialReadModel.ts', 'utf8');
    for (const table of ['invoices','payments','service_lines','part_usage','fluid_usage','work_orders']) {
      expect(source).toContain(`public.${table}`);
    }
    expect(source.match(/organization_id=\$1/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('reports receivables aging and supported direct-cost profitability', () => {
    const source = readFileSync('src/server/services/financialReadModel.ts', 'utf8');
    for (const bucket of ['current','1-30','31-60','61-90','90+']) expect(source).toContain(`'${bucket}'`);
    expect(source).toContain('grossProfit');
    expect(source).toContain('grossMarginPercent');
    expect(source).toContain('labor cost is unavailable');
  });

  it('makes financial and maintenance intelligence reachable by the agent', () => {
    const runtime = readFileSync('src/server/services/fleetAgentRuntime.ts', 'utf8');
    const router = readFileSync('src/server/services/agentToolRouter.ts', 'utf8');
    expect(runtime).toContain('maintenanceIntelligenceService.attention(organizationId)');
    expect(runtime).toContain('financialReadModelService.dashboard(organizationId)');
    expect(router).toContain("'financials.summary'");
    expect(router).toContain("'payments.search'");
  });
});
