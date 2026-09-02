import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Schedule and dispatch conflict contract', () => {
  it('checks vehicle appointment overlap and technician/resource dispatch overlap', () => {
    const source = readFileSync('src/server/services/scheduleDispatch.ts', 'utf8');
    expect(source).toContain('assertAppointmentSlot');
    expect(source).toContain('assertDispatchSlot');
    expect(source).toContain('overlapping appointment');
    expect(source).toContain('overlapping dispatch');
  });

  it('checks availability in the same organization', () => {
    const source = readFileSync('src/server/services/scheduleDispatch.ts', 'utf8');
    expect(source).toContain("availability?${availabilityQuery}");
    expect(source).toContain('organization_id: `eq.${org}`');
    expect(source).toContain('unavailable for the requested time');
  });
});
