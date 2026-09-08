import{readFileSync}from'node:fs';import{describe,expect,it}from'vitest';
const paging=readFileSync('src/server/services/operationalListPaging.ts','utf8');
const customers=readFileSync('src/server/routes/customerParts.ts','utf8');
const vehicles=readFileSync('src/server/routes/vehicleManagement.ts','utf8');
const prospects=readFileSync('src/server/routes/prospectManagement.ts','utf8');
const work=readFileSync('src/server/routes/operations.ts','utf8');
const listState=readFileSync('src/lib/operationalListState.ts','utf8');
const vehicleUi=readFileSync('src/components/vehicles/ConnectedVehicleWorkspace.tsx','utf8');
const workUi=readFileSync('src/components/operations/WorkOrdersCertifiedWorkspace.tsx','utf8');
const prospectUi=readFileSync('src/components/operations/ProspectCommandCenter.tsx','utf8');
const prospectCrud=readFileSync('src/components/operations/ProspectCrudWorkspace.tsx','utf8');
const accountUi=readFileSync('src/components/operations/FleetAccountsCertifiedWorkspace.tsx','utf8');

describe('operational list architecture',()=>{
 it('uses bounded keyset pagination instead of unbounded registry reads',()=>{expect(paging).toContain('Math.min(100');expect(paging).toContain('(x.updated_at, x.id::text) <');expect(paging).toContain('ORDER BY x.updated_at DESC,x.id DESC');expect(paging).toContain('nextCursor');expect(paging).not.toContain(' OFFSET ')});
 it('pages Fleet Accounts server-side without whole-fleet bootstrap dependency',()=>{expect(customers).toContain('pagedCustomers');expect(customers).toContain('nextCursor:page.nextCursor');expect(accountUi).not.toContain('/api/fleet-service/bootstrap');expect(paging).toContain('"openWorkCount"');expect(paging).toContain('"agreementName"')});
 it('pages Vehicles server-side before the legacy API router',()=>{expect(vehicles).toContain("vehicleManagementRouter.get('/vehicles'");expect(vehicles).toContain('pagedVehicles');expect(vehicles).toContain('search:req.query.search??req.query.q')});
 it('pages Prospects with server-side search and stage filters',()=>{expect(prospects).toContain('pagedProspects');expect(prospects).toContain('stage:req.query.stage');expect(prospects).toContain('cursor:req.query.cursor');expect(prospectCrud).not.toContain('.slice(0,20)')});
 it('pages Work Orders and preserves technician scope in the query',()=>{expect(work).toContain('pagedWorkOrders');expect(work.replace(/\s+/g,'')).toContain('technicianId:scope.isTechnician?scope.technicianId:null');expect(work).toContain('nextCursor:page.nextCursor')});
 it('keeps every paged registry organization-scoped',()=>{for(const table of ['customers x','vehicles x','prospects x','work_orders x'])expect(paging).toContain(table);expect(paging.match(/x\.organization_id=\$1/g)?.length).toBeGreaterThanOrEqual(4)});
 it('persists list filters in URL state and preserves return position',()=>{expect(listState).toContain('window.history.replaceState');expect(listState).toContain('sessionStorage.setItem');for(const source of[vehicleUi,workUi,prospectUi,accountUi]){expect(source).toContain('readListParam');expect(source).toContain('replaceListParams');expect(source).toContain('restoreListScroll')}});
 it('exposes explicit progressive loading instead of hidden truncation',()=>{for(const [source,label]of[[vehicleUi,'Load more vehicles'],[workUi,'Load more work orders'],[prospectUi,'Load more prospects'],[accountUi,'Load more Fleet Accounts'],[prospectCrud,'Load more manual records']]as const){expect(source).toContain('nextCursor');expect(source).toContain(label)}});
 it('keeps registry search server-side rather than filtering loaded arrays',()=>{for(const source of[vehicleUi,workUi,prospectUi,accountUi])expect(source).toContain("p.set('search'");expect(vehicleUi).not.toContain('vehicles.filter(');expect(workUi).not.toContain('items.filter(x=>');expect(accountUi).not.toContain('rows.filter(')});
});
