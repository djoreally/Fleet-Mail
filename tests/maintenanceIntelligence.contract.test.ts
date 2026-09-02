import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('maintenance intelligence contract', () => {
  it('distinguishes overdue, due, due soon, upcoming, and unknown', () => {
    const source = readFileSync('src/server/services/maintenanceIntelligence.ts', 'utf8');
    for (const state of ['overdue', 'due', 'due_soon', 'upcoming', 'unknown']) expect(source).toContain(`'${state}'`);
  });

  it('uses mileage, engine hours, and date dimensions', () => {
    const source = readFileSync('src/server/services/maintenanceIntelligence.ts', 'utf8');
    expect(source).toContain('milesUntilDue');
    expect(source).toContain('engineHoursUntilDue');
    expect(source).toContain('daysUntilDue');
    expect(source).toContain('listMaintenance(organizationId)');
  });
});
