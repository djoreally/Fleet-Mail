import{readFileSync}from'node:fs';import{describe,expect,it}from'vitest';

describe('operational UI hierarchy',()=>{
 const accounts=readFileSync('src/components/operations/FleetAccountsCertifiedWorkspace.tsx','utf8');
 const moduleView=readFileSync('src/components/FleetModuleView.tsx','utf8');
 const operationsApi=readFileSync('src/components/operations/operationsApi.ts','utf8');
 const fleetRoute=readFileSync('src/server/routes/fleetService.ts','utf8');
 it('makes Fleet Accounts the parent entry point',()=>{expect(accounts).toContain('Fleet customers');expect(accounts).toContain('Add Fleet Account');expect(accounts).toContain('Fleet account onboarding');expect(moduleView).toContain('customers:<FleetAccountsCertifiedWorkspace/>')});
 it('persists account then binds agreement and vehicle to that parent',()=>{expect(accounts).toContain('1. Create fleet account');expect(accounts).toContain('2. Agreement, SLA & pricing');expect(accounts).toContain('3. Add first vehicle');expect(accounts).toContain('/api/fleet-service/accounts/${encodeURIComponent(accountId)}/agreements');expect(accounts).toContain('/api/fleet-service/accounts/${encodeURIComponent(accountId)}/vehicles');expect(fleetRoute).toContain("post('/accounts/:customerId/agreements'");expect(fleetRoute).toContain("post('/accounts/:customerId/vehicles'")});
 it('recovers interrupted onboarding from persisted account rows',()=>{expect(accounts).toContain('Continue setup');expect(accounts).toContain("setStep(!s.hasAgreement?'agreement':s.vehicles===0?'vehicle':'done')");expect(accounts).toContain('This onboarding session lost its Fleet Account id')});
 it('exposes canonical edit and guarded delete operations',()=>{expect(accounts).toContain('operationsApi.updateCustomer');expect(accounts).toContain('operationsApi.deleteCustomer');expect(accounts).toContain('Edit fleet account');expect(accounts).toContain('Delete ${r.name}?')});
 it('opens account detail through a Vercel-safe single-segment fleet-service route',()=>{expect(operationsApi).toContain('/api/fleet-service/account-overview?id=');expect(fleetRoute).toContain("get('/account-overview'");expect(fleetRoute).toContain('fleetAccount360Service.get')});
 it('keeps global modules isolated instead of rendering connected-service peer tabs everywhere',()=>{expect(moduleView).toContain('<ScheduleDispatchView mode="dispatch"/>');expect(moduleView).toContain('<ScheduleDispatchView mode="schedule"/>');expect(moduleView).toContain('parts:<PartsWorkspace/>');expect(moduleView).toContain("'work-orders':<CertifiedWorkOrderModule/>")});
 it('uses mobile-first cards and bounded desktop tables',()=>{expect(accounts).toContain('md:hidden');expect(accounts).toContain('hidden overflow-hidden rounded-xl border bg-white md:block');expect(accounts).toContain('min-w-[900px]');expect(accounts).toContain('min-h-11')});
});
