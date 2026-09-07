import{readFileSync}from'node:fs';import{describe,expect,it}from'vitest';

describe('operational UI hierarchy',()=>{
 const fleet=readFileSync('src/components/operations/FleetServiceWorkspace.tsx','utf8');
 const moduleView=readFileSync('src/components/FleetModuleView.tsx','utf8');
 it('keeps the connected fleet hierarchy visible in the operating workspace',()=>{expect(fleet).toContain('Client → Vehicle → Work order → Dispatch');expect(fleet).toContain('Active client context');expect(fleet).toContain("initialTab='accounts'");});
 it('uses dense operational tables with sticky identity context',()=>{expect(fleet).toContain('sticky left-0');expect(fleet).toContain('border-separate border-spacing-0');expect(fleet).toContain('Vehicle service writer');});
 it('preserves deterministic work-order inheritance through schedule and dispatch',()=>{expect(fleet).toContain('Client and vehicle are inherited and cannot be recombined.');expect(fleet).toContain('The assignment is written back to the work order.');expect(fleet).toContain('/api/fleet-operations/appointments');expect(fleet).toContain('/api/fleet-operations/dispatch');});
 it('keeps SLA pricing, services, vehicle parts, and work orders in one UI model',()=>{expect(fleet).toContain('SLA & service agreement');expect(fleet).toContain('Pricing matrix');expect(fleet).toContain('Assigned / preferred part');expect(fleet).toContain('Create connected work order');});
 it('renders the lifecycle as a compact rail instead of a dashboard card',()=>{expect(moduleView).toContain("const lifecycle=['Prospect','Win','Fleet account','SLA + pricing','Vehicle','Work order','Schedule','Dispatch','Service','Invoice','Retain']");expect(moduleView).toContain('border-y border-slate-200');expect(moduleView).not.toContain('Sparkles');});
});
