import{readFileSync}from'node:fs';import{describe,expect,it}from'vitest';
const paging=readFileSync('src/server/services/operationalListPaging.ts','utf8');
const customers=readFileSync('src/server/routes/customerParts.ts','utf8');
const vehicles=readFileSync('src/server/routes/vehicleManagement.ts','utf8');
const prospects=readFileSync('src/server/routes/prospectManagement.ts','utf8');
const work=readFileSync('src/server/routes/operations.ts','utf8');

describe('operational list architecture',()=>{
 it('uses bounded keyset pagination instead of unbounded registry reads',()=>{expect(paging).toContain('Math.min(100');expect(paging).toContain('(x.updated_at, x.id::text) <');expect(paging).toContain('ORDER BY x.updated_at DESC,x.id DESC');expect(paging).toContain('nextCursor');expect(paging).not.toContain(' OFFSET ')});
 it('pages Fleet Accounts server-side',()=>{expect(customers).toContain('pagedCustomers');expect(customers).toContain('nextCursor:page.nextCursor');expect(customers).toContain('hasMore:page.hasMore')});
 it('pages Vehicles server-side before the legacy API router',()=>{expect(vehicles).toContain("vehicleManagementRouter.get('/vehicles'");expect(vehicles).toContain('pagedVehicles');expect(vehicles).toContain('search:req.query.search??req.query.q')});
 it('pages Prospects with server-side search and stage filters',()=>{expect(prospects).toContain('pagedProspects');expect(prospects).toContain('stage:req.query.stage');expect(prospects).toContain('cursor:req.query.cursor')});
 it('pages Work Orders and preserves technician scope in the query',()=>{expect(work).toContain('pagedWorkOrders');expect(work).toContain('technicianId:scope.isTechnician?scope.technicianId:null');expect(work).toContain('nextCursor:page.nextCursor')});
 it('keeps every paged registry organization-scoped',()=>{for(const table of ['customers x','vehicles x','prospects x','work_orders x'])expect(paging).toContain(table);expect(paging.match(/x\.organization_id=\$1/g)?.length).toBeGreaterThanOrEqual(4)});
});
