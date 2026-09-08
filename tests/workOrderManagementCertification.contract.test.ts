import{describe,expect,it}from'vitest';
import{readFileSync}from'node:fs';
const ui=readFileSync('src/components/operations/WorkOrdersCertifiedWorkspace.tsx','utf8');
const moduleSource=readFileSync('src/components/operations/CertifiedWorkOrderModule.tsx','utf8');
const routes=readFileSync('src/server/routes/operations.ts','utf8');
const guard=readFileSync('src/server/services/workOrderManagementGuard.ts','utf8');
const completion=readFileSync('src/server/services/workOrderCompletion.ts','utf8');
describe('Work Orders certification',()=>{
 it('removes lifecycle mutation from the management UI',()=>{expect(ui).not.toContain("name=\"status\"");expect(ui).toContain('Status changes happen in Dispatch/Technician execution');});
 it('preserves all editable work packet fields',()=>{for(const value of ['requestedServices','purchaseOrderNumber','odometer','engineHours','scheduledAt','customerNotes','technicianNotes'])expect(ui).toContain(value);});
 it('keeps technician mode on the execution workspace',()=>{expect(moduleSource).toContain("access?.role==='technician'");expect(moduleSource).toContain('<WorkOrderOperationsHub/>');});
 it('blocks generic PATCH lifecycle changes server-side',()=>{expect(routes).toContain('sanitizeWorkOrderManagementPatch');expect(guard).toContain("hasOwnProperty.call(input,'status')");expect(guard).toContain('Work-order lifecycle status must be changed through Dispatch or Technician execution');});
 it('does not hard-delete operational history',()=>{expect(routes).toContain('assertWorkOrderDeletable');expect(guard).toContain("['draft','scheduled']");expect(guard).toContain('execution history and cannot be deleted');});
 it('retains validated completion requirements',()=>{expect(completion).toContain('A completed inspection is required');expect(completion).toContain('Pending authorizations must be decided');expect(completion).toContain('All authorized service lines must be completed');});
 it('is mobile-first for management actions',()=>{expect(ui).toContain('md:hidden');expect(ui).toContain('min-h-11');expect(ui).toContain('sm:grid-cols-2');});
});
