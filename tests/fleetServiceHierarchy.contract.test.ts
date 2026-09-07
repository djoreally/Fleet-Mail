import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('canonical Fleet service hierarchy',()=>{
 const migration=readFileSync('src/db/migrations/0008_fleet_service_model.sql','utf8');
 const service=readFileSync('src/server/services/fleetServiceModel.ts','utf8');
 const schedule=readFileSync('src/server/routes/scheduleDispatch.ts','utf8');
 const ui=readFileSync('src/components/operations/FleetServiceWorkspace.tsx','utf8');
 const moduleView=readFileSync('src/components/FleetModuleView.tsx','utf8');
 it('makes client ownership mandatory through vehicle, work order and appointment',()=>{expect(migration).toContain('ALTER TABLE public.vehicles ALTER COLUMN customer_id SET NOT NULL');expect(migration).toContain('work_orders_vehicle_customer_chain_fk');expect(migration).toContain('appointments_work_order_chain_fk')});
 it('adds ServiceWriter-style SLA, service catalog, pricing and vehicle fitment tables',()=>{for(const table of ['service_catalog','fleet_service_agreements','fleet_agreement_services','vehicle_service_profiles','vehicle_parts'])expect(migration).toContain(`CREATE TABLE public.${table}`);expect(service).toContain('approval_threshold');expect(service).toContain('invoice_frequency');expect(service).toContain('fleet_agreement_services')});
 it('derives schedule customer and vehicle from the selected work order',()=>{expect(schedule).toContain('workOrderChain');expect(schedule).toContain('customerId:chain.customer_id');expect(schedule).toContain('vehicleId:chain.vehicle_id')});
 it('synchronizes dispatch assignment back to work_orders.technician_id',()=>{expect(schedule).toContain('syncWorkOrderTechnician');expect(service).toContain('UPDATE work_orders SET technician_id=$3')});
 it('blocks orphan forms and scopes vehicle selection to the client',()=>{expect(ui).toContain('A vehicle cannot be created without a client');expect(ui).toContain('vehicles.filter(x=>x.customer_id===customerId)');expect(ui).toContain('Client first. Vehicle second. Agreement and pricing third.')});
 it('uses safe parts deletion and exposes vehicle part assignment',()=>{expect(service).toContain("SELECT 1 FROM part_usage");expect(service).toContain('DELETE FROM vehicle_parts');expect(ui).toContain('/parts/${part}');expect(ui).toContain('Assign part')});
 it('keeps work orders on the isolated work-order execution workspace',()=>{expect(moduleView).toContain("'work-orders':<WorkOrderOperationsHub/>");expect(moduleView).not.toContain('FleetServiceWorkspace')});
});
