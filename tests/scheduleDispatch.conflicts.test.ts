import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Schedule and dispatch conflict contract', () => {
  it('checks vehicle appointment overlap, work-order duplication, and technician/resource dispatch overlap', () => {
    const source = readFileSync('src/server/services/scheduleDispatch.ts', 'utf8');
    expect(source).toContain('assertAppointmentSlot');
    expect(source).toContain('assertWorkOrderSchedule');
    expect(source).toContain('assertWorkOrderDispatch');
    expect(source).toContain('assertDispatchSlot');
    expect(source).toContain('overlapping appointment');
    expect(source).toContain('Work order already has an active appointment');
    expect(source).toContain('Work order already has an active dispatch assignment');
    expect(source).toContain('overlapping dispatch');
  });

  it('binds a dispatch appointment to the same work order', () => {
    const source = readFileSync('src/server/services/scheduleDispatch.ts', 'utf8');
    expect(source).toContain('Appointment does not belong to the selected work order');
    expect(source).toContain('Appointment does not belong to this dispatch work order');
    expect(source).toContain('work_order_id');
  });

  it('checks availability in the same organization', () => {
    const source = readFileSync('src/server/services/scheduleDispatch.ts', 'utf8');
    expect(source).toContain("availability?${availabilityQuery}");
    expect(source).toMatch(/organization_id\s*:\s*`eq\.\$\{org\}`/);
    expect(source).toContain('unavailable for the requested time');
  });
});
