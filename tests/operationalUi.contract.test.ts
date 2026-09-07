import{readFileSync}from'node:fs';import{describe,expect,it}from'vitest';

describe('operational UI hierarchy',()=>{
 const fleet=readFileSync('src/components/operations/FleetServiceWorkspace.tsx','utf8');
 const accounts=readFileSync('src/components/operations/FleetAccountsWorkspace.tsx','utf8');
 const moduleView=readFileSync('src/components/FleetModuleView.tsx','utf8');
 it('makes Fleet Accounts the parent entry point',()=>{expect(accounts).toContain('Fleet customers');expect(accounts).toContain('Add Fleet Account');expect(accounts).toContain('Fleet account onboarding');expect(moduleView).toContain('customers:<FleetAccountsWorkspace/>')});
 it('onboards account then agreement then vehicle',()=>{expect(accounts).toContain('1. Create the fleet account');expect(accounts).toContain('2. Agreement, SLA & pricing rules');expect(accounts).toContain('3. Add the first vehicle');expect(accounts).toContain('/api/fleet-service/agreements');expect(accounts).toContain('/api/fleet-service/vehicles')});
 it('keeps account children attached to the account',()=>{expect(accounts).toContain('parent record for everything that follows');expect(accounts).toContain('Vehicles are created inside');expect(accounts).toContain('Open account')});
 it('uses blue primary product actions',()=>{expect(accounts).toContain('bg-blue-600');expect(accounts).not.toContain('bg-slate-950 px-4 text-sm font-bold text-white')});
 it('preserves deterministic service hierarchy and technician isolation',()=>{expect(fleet).toContain('Client → Vehicle → Work order → Dispatch');expect(fleet).toContain('/api/fleet-operations/appointments');expect(fleet).toContain('/api/fleet-operations/dispatch');expect(moduleView).toContain("role==='technician'?<WorkOrderOperationsHub/>")});
 it('uses explicit touch-scroll containers for wide account tables',()=>{expect(accounts).toContain('data-hscroll');expect(accounts).toContain('min-w-[820px]')});
});
