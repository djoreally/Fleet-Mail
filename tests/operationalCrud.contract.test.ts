import{readFileSync}from'node:fs';import{describe,expect,it}from'vitest';

const app=readFileSync('src/server/app.ts','utf8');
const customers=readFileSync('src/components/operations/FleetAccountsCertifiedWorkspace.tsx','utf8');
const customerRoutes=readFileSync('src/server/routes/customerParts.ts','utf8');
const vehicles=readFileSync('src/components/vehicles/ConnectedVehicleWorkspace.tsx','utf8');
const vehicleRoutes=readFileSync('src/server/routes/vehicleManagement.ts','utf8');
const workOrders=readFileSync('src/components/operations/WorkOrdersCertifiedWorkspace.tsx','utf8');
const workOrderRoutes=readFileSync('src/server/routes/operations.ts','utf8');
const prospects=readFileSync('src/components/operations/ProspectCrudWorkspace.tsx','utf8');
const prospectRoutes=readFileSync('src/server/routes/prospectManagement.ts','utf8');
const moduleView=readFileSync('src/components/FleetModuleView.tsx','utf8');

describe('operational manual CRUD contract',()=>{
 it('certifies Fleet Accounts manual create/read/update/delete handlers',()=>{expect(customers).toContain('Add Fleet Account');expect(customers).toContain('operationsApi.createCustomer');expect(customers).toContain('operationsApi.updateCustomer');expect(customers).toContain('operationsApi.deleteCustomer');expect(customerRoutes).toContain("post('/customers'");expect(customerRoutes).toContain("put('/customers/:id'");expect(customerRoutes).toContain("delete('/customers/:id'")});
 it('certifies Vehicles manual create/read/update/delete handlers',()=>{expect(vehicles).toContain('Add vehicle');expect(vehicles).toContain("method:selected?'PUT':'POST'");expect(vehicles).toContain("method:'DELETE'");expect(vehicleRoutes).toContain("post('/vehicles'");expect(vehicleRoutes).toContain("put('/vehicles/:id'");expect(vehicleRoutes).toContain("delete('/vehicles/:id'")});
 it('certifies Work Orders manual create/read/update/delete with guarded history deletion',()=>{expect(workOrders).toContain('Create work order');expect(workOrders).toContain("method:editing?'PATCH':'POST'");expect(workOrders).toContain("method:'DELETE'");expect(workOrderRoutes).toContain("post('/work-orders'");expect(workOrderRoutes).toContain("patch('/work-orders/:id'");expect(workOrderRoutes).toContain("delete('/work-orders/:id'");expect(workOrderRoutes).toContain('assertWorkOrderDeletable')});
 it('certifies Prospects manual create/read/update/delete and preserves converted acquisition history',()=>{expect(prospects).toContain('Add prospect manually');expect(prospects).toContain("method:editing?'PATCH':'POST'");expect(prospects).toContain("method:'DELETE'");expect(prospectRoutes).toContain("post('/prospects'");expect(prospectRoutes).toContain("patch('/prospects/:id'");expect(prospectRoutes).toContain("delete('/prospects/:id'");expect(prospectRoutes).toContain('Converted prospects cannot be deleted')});
 it('mounts every operational CRUD router under the paths used by the UI',()=>{expect(app).toContain("app.use('/api',vehicleManagementRouter)");expect(app).toContain("app.use('/api/operations',operationsRouter)");expect(app).toContain("app.use('/api/operations',customerPartsRouter)");expect(app).toContain("app.use('/api/operations',prospectManagementRouter)");expect(moduleView).toContain('customers:<FleetAccountsCertifiedWorkspace/>');expect(moduleView).toContain('vehicles:<ConnectedVehicleWorkspace/>');expect(moduleView).toContain("'work-orders':<CertifiedWorkOrderModule/>");expect(moduleView).toContain('prospects:<ProspectingLive/>')});
});
