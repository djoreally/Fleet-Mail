import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const technicianUi = readFileSync('src/components/operations/TechnicianWorkspace.tsx', 'utf8');
const executionService = readFileSync('src/server/services/workOrderExecution.ts', 'utf8');
const completionService = readFileSync('src/server/services/workOrderCompletion.ts', 'utf8');
const fleetModule = readFileSync('src/components/FleetModuleView.tsx', 'utf8');

describe('technician execution contract', () => {
  it('exposes the technician workflow from the canonical work-order module', () => {
    expect(fleetModule).toContain('CertifiedWorkOrderModule');
    expect(technicianUi).toContain('Inspection → Authorization → Service');
    expect(technicianUi).toContain('/inspections/');
    expect(technicianUi).toContain('/authorizations/');
    expect(technicianUi).toContain('/service-lines/');
    expect(technicianUi).toContain('/complete-validated');
  });

  it('does not trust a caller-supplied service-line authorization flag', () => {
    expect(executionService).toContain("approval.status === 'authorized'");
    expect(executionService).toContain('input.authorized === true && hasPersistedApproval');
    expect(executionService).toContain("if (decision === 'authorized')");
  });

  it('keeps work-order completion behind inspection, authorization and service gates', () => {
    expect(completionService).toContain('A completed inspection is required');
    expect(completionService).toContain('Pending authorizations must be decided');
    expect(completionService).toContain('All authorized service lines must be completed');
  });
});
