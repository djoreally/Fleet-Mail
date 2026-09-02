import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Fleet Account revenue provenance contract', () => {
  it('links converted prospects to the resulting Fleet Account', () => {
    const source = readFileSync('src/server/services/fleetAccount360.ts', 'utf8');
    expect(source).toContain('eq(prospects.convertedCustomerId, customerId)');
    expect(source).toContain('sourceProspects');
    expect(source).toContain('revenueHistory');
  });

  it('preserves prospect contacts and AgentMail-backed activity history under organization scope', () => {
    const source = readFileSync('src/server/services/fleetAccount360.ts', 'utf8');
    expect(source).toContain('prospectContacts.organizationId, organizationId');
    expect(source).toContain('prospectActivities.organizationId, organizationId');
    expect(source).toContain('sourceProspectActivityRows');
    expect(source).toContain('externalMessageId');
  });
});
