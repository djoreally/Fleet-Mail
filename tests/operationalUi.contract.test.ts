import{readFileSync}from'node:fs';import{describe,expect,it}from'vitest';

describe('operational UI hierarchy',()=>{
 const accounts=readFileSync('src/components/operations/FleetAccountsWorkspace.tsx','utf8');
 const moduleView=readFileSync('src/components/FleetModuleView.tsx','utf8');
 const operationsApi=readFileSync('src/components/operations/operationsApi.ts','utf8');
 const fleetRoute=readFileSync('src/server/routes/fleetService.ts','utf8');
 it('makes Fleet Accounts the parent entry point',()=>{expect(accounts).toContain('Fleet customers');expect(accounts).toContain('Add Fleet Account');expect(accounts).toContain('Fleet account onboarding');expect(moduleView).toContain('customers:<FleetAccountsWorkspace/>')});
 it('onboards account then agreement then vehicle',()=>{expect(accounts).toContain('1. Create the fleet account');expect(accounts).toContain('2. Agreement, SLA & pricing rules');expect(accounts).toContain('3. Add the first vehicle');expect(accounts).toContain('/api/fleet-service/agreements');expect(accounts).toContain('/api/fleet-service/vehicles')});
 it('validates onboarding fields on blur before submit',()=>{expect(accounts).toContain('onBlur');expect(accounts).toContain('validateAccount');expect(accounts).toContain('validateAgreement');expect(accounts).toContain('validateVehicle');expect(accounts).toContain('Fields validate as soon as you leave them.')});
 it('opens account detail through a Vercel-safe single-segment fleet-service route',()=>{expect(operationsApi).toContain('/api/fleet-service/account-overview?id=');expect(fleetRoute).toContain("get('/account-overview'");expect(fleetRoute).toContain('fleetAccount360Service.get')});
 it('keeps global modules isolated instead of rendering the connected-service peer tabs everywhere',()=>{expect(moduleView).toContain('<ScheduleDispatchView mode="dispatch"/>');expect(moduleView).toContain('<ScheduleDispatchView mode="schedule"/>');expect(moduleView).toContain('parts:<PartsWorkspace/>');expect(moduleView).toContain("'work-orders':<WorkOrderOperationsHub/>");expect(moduleView).not.toContain('FleetServiceWorkspace')});
 it('uses blue primary product actions',()=>{expect(accounts).toContain('bg-blue-600');expect(accounts).not.toContain('bg-slate-950 px-4 text-sm font-bold text-white')});
 it('uses explicit touch-scroll containers for wide account tables',()=>{expect(accounts).toContain('data-hscroll');expect(accounts).toContain('min-w-[820px]')});
});
