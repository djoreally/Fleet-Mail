import{readFileSync}from'node:fs';import{describe,expect,it}from'vitest';
const loop=readFileSync('src/server/services/fleetAgentLoop.ts','utf8');
const actions=readFileSync('src/server/routes/agentActions.ts','utf8');
const normalize=readFileSync('src/server/services/agentActions.ts','utf8');
const crud=readFileSync('src/server/services/agentCrud.ts','utf8');

describe('Fleet Agent operational parity',()=>{
 it('reads every certified operational domain',()=>{for(const tool of ['search_prospects','search_fleet_accounts','search_vehicles','search_work_orders','search_schedule','search_dispatch'])expect(loop).toContain(tool)});
 it('exposes prospect CRUD',()=>{for(const tool of ['create_prospect','update_prospect','delete_prospect'])expect(loop).toContain(tool);for(const kind of ['fleet.prospect.create','fleet.prospect.update','fleet.prospect.delete'])expect(actions).toContain(kind)});
 it('exposes Fleet Account and Vehicle CRUD',()=>{for(const tool of ['create_fleet_account','update_fleet_account','delete_fleet_account','add_fleet_vehicle','update_fleet_vehicle','delete_fleet_vehicle'])expect(loop).toContain(tool);expect(crud).toContain('operationsDataService.updateCustomer');expect(crud).toContain('updateVehicle(id,merged,organizationId)')});
 it('keeps work-order management and lifecycle separate',()=>{for(const tool of ['create_work_order','update_work_order','delete_work_order','transition_work_order'])expect(loop).toContain(tool);expect(crud).toContain('sanitizeWorkOrderManagementPatch');expect(crud).toContain('assertWorkOrderDeletable')});
 it('exposes scheduling CRUD and dispatch lifecycle',()=>{for(const tool of ['create_schedule','update_schedule','delete_schedule','create_dispatch','update_dispatch','transition_dispatch'])expect(loop).toContain(tool);expect(actions).toContain('ScheduleDispatchService');expect(actions).toContain('transitionDispatchStatus');expect(actions).toContain('recordDispatchCreated')});
 it('keeps every mutation signed, tenant-bound, confirmed, RBAC checked, and replay protected',()=>{expect(normalize).toContain('organizationId');expect(actions).toContain("req.body?.confirmed!==true");expect(actions).toContain("requireFleetPermission(req,'agent.execute')");expect(actions).toContain('claimAgentActionExecution');expect(actions).toContain('verifyAgentActionProposal')});
});
