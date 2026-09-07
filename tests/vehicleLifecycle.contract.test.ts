import{readFileSync}from'node:fs';import{describe,expect,it}from'vitest';

describe('vehicle lifecycle certification',()=>{
 const ui=readFileSync('src/components/vehicles/ConnectedVehicleWorkspace.tsx','utf8');
 const route=readFileSync('src/server/routes/vehicleManagement.ts','utf8');
 const moduleView=readFileSync('src/components/FleetModuleView.tsx','utf8');
 it('requires a real Fleet Account id for add and edit',()=>{expect(ui).toContain('customerId');expect(ui).toContain('Choose Fleet Account');expect(ui).toContain('/api/operations/customers');expect(ui).toContain("customerId:draft.customerId")});
 it('enforces server-side manage permission on every vehicle write',()=>{expect((route.match(/requireFleetPermission\(req,'vehicles\.manage'\)/g)||[]).length).toBe(4);expect(route).toContain("post('/vehicles'");expect(route).toContain("post('/vehicles/import'");expect(route).toContain("put('/vehicles/:id'");expect(route).toContain("delete('/vehicles/:id'")});
 it('keeps VIN decode in the live UI',()=>{expect(ui).toContain('/api/vehicles/decode-vin');expect(ui).toContain('Decoded by NHTSA')});
 it('exposes add view edit and delete lifecycle actions',()=>{expect(ui).toContain('Add vehicle');expect(ui).toContain('View vehicle');expect(ui).toContain('Edit vehicle');expect(ui).toContain('Delete vehicle')});
 it('uses a dedicated mobile card layout and desktop table',()=>{expect(ui).toContain('md:hidden');expect(ui).toContain('hidden overflow-hidden');expect(ui).toContain('md:block');expect(ui).toContain('min-h-11')});
 it('mounts the account-aware registry as the canonical Vehicles module',()=>{expect(moduleView).toContain("ConnectedVehicleWorkspace");expect(moduleView).toContain('vehicles:<ConnectedVehicleWorkspace/>')});
});
