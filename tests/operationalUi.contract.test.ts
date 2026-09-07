import{readFileSync}from'node:fs';import{describe,expect,it}from'vitest';

describe('operational UI hierarchy',()=>{
 const accounts=readFileSync('src/components/operations/FleetAccountsCertifiedWorkspace.tsx','utf8');
 const moduleView=readFileSync('src/components/FleetModuleView.tsx','utf8');
 const operationsApi=readFileSync('src/components/operations/operationsApi.ts','utf8');
 const fleetRoute=readFileSync('src/server/routes/fleetService.ts','utf8');
 it('makes Fleet Accounts the parent entry point',()=>{expect(accounts).toContain('Fleet customers');expect(accounts).toContain('Add Fleet Account');expect(accounts).toContain('Fleet account onboarding');expect(moduleView).toContain('customers:<FleetAccountsCertifiedWorkspace/>')});
 it('onboards account then agreement then vehicle',()=>{expect(accounts).toContain('1. Create the fleet account');expect(accounts).toContain('2. Agreement, SLA & pricing rules');expect(accounts).toContain('3. Add the first vehicle');expect(accounts).toContain('/api/fleet-service/agreements');expect(accounts).toContain('/api/fleet-service/vehicles')});
 it('recovers interrupted onboarding without creating another customer',()=>{expect(accounts).toContain('Setup incomplete — continue');expect(accounts).toContain('Continue setup');expect(accounts).toContain("setStep(!s.agreement?'agreement':s.vehicles===0?'vehicle':'done')")});
 it('exposes canonical edit and delete operations',()=>{expect(accounts).toContain('operationsApi.updateCustomer');expect(accounts).toContain('operationsApi.deleteCustomer');expect(accounts).toContain('Edit fleet account');expect(accounts).toContain('Delete fleet account')});
 it('opens account detail through a Vercel-safe single-segment fleet-service route',()=>{expect(operationsApi).toContain('/api/fleet-service/account-overview?id=');expect(fleetRoute).toContain("get('/account-overview'");expect(fleetRoute).toContain('fleetAccount360Service.get')});
 it('keeps global modules isolated instead of rendering connected-service peer tabs everywhere',()=>{expect(moduleView).toContain('<ScheduleDispatchView mode="dispatch"/>');expect(moduleView).toContain('<ScheduleDispatchView mode="schedule"/>');expect(moduleView).toContain('parts:<PartsWorkspace/>');expect(moduleView).toContain("'work-orders':<WorkOrderOperationsHub/>")});
 it('uses explicit mobile-safe scrolling and touch targets',()=>{expect(accounts).toContain('data-hscroll');expect(accounts).toContain('min-w-[940px]');expect(accounts).toContain('min-h-10');expect(accounts).toContain('sm:p-5')});
});
