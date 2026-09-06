import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fleetRoleHasPermission } from '../src/server/services/rbac';

describe('technician work-order workspace isolation', () => {
  const source = readFileSync('src/components/operations/TechnicianWorkspace.tsx', 'utf8');

  it('locks the effective technician role directly into technician execution', () => {
    expect(source).toContain("const technicianOnly=access?.role==='technician'");
    expect(source).toContain("if(technicianOnly)return <div className=\"flex min-h-0 flex-1 flex-col\"><TechnicianExecutionWorkspace canDecideAuthorization={false}/></div>");
    expect(source).toContain("if(technicianOnly&&mode!=='technician')setMode('technician')");
  });

  it('does not expose authorization decision controls to technicians', () => {
    expect(fleetRoleHasPermission('technician','authorizations.manage')).toBe(false);
    expect(source).toContain("canDecideAuthorization&&auth.status==='pending'");
  });

  it('preserves the full work-order hub for non-technician roles', () => {
    expect(source).toContain('Work orders</button>');
    expect(source).toContain('Technician execution</button>');
    expect(source).toContain("mode==='orders'?<WorkOrdersWorkspace/>:<TechnicianExecutionWorkspace canDecideAuthorization={canDecideAuthorization}/>");
  });
});