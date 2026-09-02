import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Fleet Account 360 contract', () => {
  it('includes PM, inspection, recommendation, financial, and communication context', () => {
    const source = readFileSync('src/server/services/fleetAccount360.ts', 'utf8');
    for (const term of ['maintenanceSchedules', 'dueMaintenance', 'inspections', 'recommendations', 'outstandingBalance', 'communications']) {
      expect(source).toContain(term);
    }
  });

  it('keeps every dependent query organization scoped', () => {
    const source = readFileSync('src/server/services/fleetAccount360.ts', 'utf8');
    expect(source).toContain('eq(maintenanceSchedules.organizationId, organizationId)');
    expect(source).toContain('eq(inspections.organizationId, organizationId)');
    expect(source).toContain('eq(inspectionItems.organizationId, organizationId)');
  });
});
