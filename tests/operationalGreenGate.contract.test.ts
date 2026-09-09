import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const persistence = readFileSync('src/server/services/operationsPersistence.ts', 'utf8');
const execution = readFileSync('src/server/services/workOrderExecution.ts', 'utf8');
const completion = readFileSync('src/server/services/workOrderCompletion.ts', 'utf8');
const workOrdersUi = readFileSync('src/components/operations/WorkOrdersCertifiedWorkspace.tsx', 'utf8');
const scheduleUi = readFileSync('src/components/ScheduleDispatchView.tsx', 'utf8');

describe('operational GREEN gate regressions', () => {
  it('generates collision-resistant work order numbers and defaults new work to draft', () => {
    expect(persistence).toContain("randomUUID().slice(0,8).toUpperCase()");
    expect(persistence).not.toContain("Date.now().toString().slice(-6)");
    expect(persistence).toContain("input.status||'draft'");
  });

  it('uses completed as the canonical work order terminal state while tolerating legacy reads', () => {
    expect(persistence).toContain("'completed','cancelled'");
    expect(execution).toContain("'completed','cancelled'");
    expect(execution).toContain("canonicalNext === 'completed'");
    expect(completion).toContain("transition(organizationId, workOrderId, 'completed')");
  });

  it('does not use native Android relationship selects for vehicle or scheduling choices', () => {
    expect(workOrdersUi).toContain('Choose vehicle');
    expect(workOrdersUi).toContain('No vehicles available. Add a vehicle first.');
    expect(workOrdersUi).not.toContain('<select required={!editing}');
    expect(scheduleUi).toContain('Picker label="Work order"');
    expect(scheduleUi).toContain('No work orders available. Create a work order first.');
  });
});
