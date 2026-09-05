import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Technician OS access boundaries', () => {
  const access = readFileSync('src/server/services/technicianAccess.ts','utf8');
  const operations = readFileSync('src/server/routes/operations.ts','utf8');
  const execution = readFileSync('src/server/routes/workOrderExecution.ts','utf8');
  const completion = readFileSync('src/server/routes/workOrderCompletion.ts','utf8');
  const dashboard = readFileSync('src/components/DashboardView.tsx','utf8');

  it('resolves the signed-in technician profile and enforces assignment scope', () => {
    expect(access).toContain("access.role !== 'technician'");
    expect(access).toContain('organization_id=$1 AND id=$2 AND technician_id=$3');
    expect(access).toContain('Technicians may only access work orders assigned to them');
  });

  it('filters technician work-order lists before returning them', () => {
    expect(operations).toContain('scope.isTechnician ? rows.filter');
    expect(operations).toContain('row.technicianId === scope.technicianId');
  });

  it('separates technician execution from authorization decisions', () => {
    expect(execution).toContain("requireFleetPermission(req,'inspections.execute')");
    expect(execution).toContain("requireFleetPermission(req,'work_orders.execute')");
    expect(execution).toContain("requireFleetPermission(req,'authorizations.manage')");
    expect(completion).toContain("requireFleetPermission(req, 'work_orders.execute')");
  });

  it('renders a role-specific technician dashboard', () => {
    expect(dashboard).toContain("access?.role==='technician'");
    expect(dashboard).toContain("fleetFetch('/api/technician/me')");
    expect(dashboard).toContain('Technician OS');
    expect(dashboard).toContain('Only work assigned to your technician profile is shown');
  });
});
