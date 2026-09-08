import { Pool } from '@neondatabase/serverless';
import { operationsDataService } from './operationsData.js';
import { listVehicles, updateVehicle, deleteVehicle, type VehicleInput } from './vehicleStore.js';
import { updateWorkOrder, deleteWorkOrder } from './operationsPersistence.js';
import { assertWorkOrderDeletable, sanitizeWorkOrderManagementPatch } from './workOrderManagementGuard.js';
import { prospectingService } from './prospecting.js';

function databaseUrl(){const value=process.env.DATABASE_URL||process.env.NEON_DATABASE_URL;if(!value)throw new Error('Database is not configured');return value}
async function withPool<T>(work:(pool:Pool)=>Promise<T>){const pool=new Pool({connectionString:databaseUrl()});try{return await work(pool)}finally{await pool.end()}}
function stripUndefined(input:Record<string,unknown>){return Object.fromEntries(Object.entries(input).filter(([,v])=>v!==undefined))}

export const agentCrud={
  async updateAccount(organizationId:string,input:Record<string,unknown>){
    const id=String(input.customerId||'');const current=(await operationsDataService.listCustomers(organizationId)).find((row:any)=>String(row.id)===id);if(!current)throw new Error('Customer not found');
    const merged={name:input.name??current.name,accountNumber:input.accountNumber??current.accountNumber,primaryContactName:input.primaryContactName??current.primaryContactName,primaryContactEmail:input.primaryContactEmail??current.primaryContactEmail,billingContactName:current.billingContactName,billingEmail:current.billingEmail,billingAddressLine1:(current.billingAddress as any)?.line1||'',billingAddressLine2:(current.billingAddress as any)?.line2||'',billingCity:(current.billingAddress as any)?.city||'',billingState:(current.billingAddress as any)?.state||'',billingPostalCode:(current.billingAddress as any)?.postalCode||'',billingCountry:(current.billingAddress as any)?.country||'',poRequired:current.poRequired,defaultPoNumber:current.defaultPoNumber,paymentTerms:current.paymentTerms,taxStatus:current.taxStatus,phone:input.phone??current.phone,status:input.status??current.status,notes:input.notes??current.notes};
    return operationsDataService.updateCustomer(organizationId,id,merged);
  },
  async deleteAccount(organizationId:string,input:Record<string,unknown>){const id=String(input.customerId);const deleted=await operationsDataService.deleteCustomer(organizationId,id);if(!deleted)throw new Error('Fleet account not found');return{deleted:true,id};},

  async updateVehicle(organizationId:string,input:Record<string,unknown>){
    const id=String(input.vehicleId||'');const result=await listVehicles(organizationId);const current=result.vehicles.find((v:any)=>String(v.id)===id);if(!current)throw new Error('Vehicle not found');
    const merged:VehicleInput={customerId:String(input.customerId??current.customer_id),unitNumber:String(input.unitNumber??current.unit_number),vin:(input.vin??current.vin) as any,year:(input.year??current.year) as any,make:(input.make??current.make) as any,model:(input.model??current.model) as any,engine:(input.engine??current.engine) as any,mileage:(input.mileage??current.mileage) as any,engineHours:(input.engineHours??current.engine_hours) as any,status:(input.status??current.status) as any,licensePlate:(input.licensePlate??current.license_plate) as any,registrationState:(input.registrationState??current.registration_state) as any,assignedDriver:(input.assignedDriver??current.assigned_driver) as any,department:(input.department??current.department) as any,notes:(input.notes??current.notes) as any,specifications:current.specifications,trim:current.trim,fuelType:current.fuel_type,inServiceDate:current.in_service_date,type:current.metadata?.type,assignment:current.metadata?.assignment};
    return updateVehicle(id,merged,organizationId);
  },
  async deleteVehicle(organizationId:string,input:Record<string,unknown>){await deleteVehicle(String(input.vehicleId),organizationId);return{deleted:true,id:String(input.vehicleId)};},

  updateWorkOrder(organizationId:string,input:Record<string,unknown>){const {workOrderId,...raw}=input;return updateWorkOrder(organizationId,String(workOrderId),sanitizeWorkOrderManagementPatch(stripUndefined(raw)));},
  async deleteWorkOrder(organizationId:string,input:Record<string,unknown>){const id=String(input.workOrderId);await assertWorkOrderDeletable(organizationId,id);return{deleted:await deleteWorkOrder(organizationId,id),id};},

  createProspect(organizationId:string,input:Record<string,unknown>){return prospectingService.create(organizationId,stripUndefined(input));},
  updateProspect(organizationId:string,input:Record<string,unknown>){const {prospectId,...patch}=input;return prospectingService.update(organizationId,String(prospectId),stripUndefined(patch));},
  async deleteProspect(organizationId:string,input:Record<string,unknown>){const id=String(input.prospectId);const detail=await prospectingService.get(organizationId,id);if(detail.prospect.convertedCustomerId)throw new Error('Converted prospects cannot be deleted; retain the acquisition history.');return withPool(async pool=>{const result=await pool.query('DELETE FROM public.prospects WHERE organization_id=$1 AND id=$2 RETURNING id',[organizationId,id]);if(!result.rowCount)throw new Error('Prospect not found');return{deleted:true,id};});},

  async updateContact(organizationId:string,input:Record<string,unknown>){const id=String(input.contactId);const allowed=stripUndefined({name:input.name,email:input.email,phone:input.phone,role:input.role,notes:input.notes,...(input.isPrimary===false?{is_primary:false}:{})});const entries=Object.entries(allowed);if(!entries.length)throw new Error('At least one contact field is required');return withPool(async pool=>{const columns:Record<string,string>={name:'name',email:'email',phone:'phone',role:'role',notes:'notes',is_primary:'is_primary'};const sets=entries.map(([key],i)=>`${columns[key]}=$${i+3}`);const values=entries.map(([,v])=>v);const result=await pool.query(`UPDATE public.contacts SET ${sets.join(',')},updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *`,[organizationId,id,...values]);if(!result.rows[0])throw new Error('Contact not found');return result.rows[0];});},
  async deleteContact(organizationId:string,input:Record<string,unknown>){const id=String(input.contactId);return withPool(async pool=>{const result=await pool.query('DELETE FROM public.contacts WHERE organization_id=$1 AND id=$2 RETURNING id',[organizationId,id]);if(!result.rowCount)throw new Error('Contact not found');return{deleted:true,id};});},
};
