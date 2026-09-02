import { fleetFetch } from '../../lib/fleetApi';

export type CustomerRow = { id:string; name:string; accountNumber?:string|null; primaryContactName?:string|null; primaryContactEmail?:string|null; billingContactName?:string|null; billingEmail?:string|null; billingAddress?:Record<string,string>|null; poRequired?:boolean; defaultPoNumber?:string|null; paymentTerms?:string; taxStatus?:string; phone?:string|null; notes?:string|null; status:string; vehicleCount:number; primaryContact?:string|null; contactEmail?:string|null; spend30Days:string };
export type PartRow = { id:string; sku:string; name:string; description?:string|null; unitCost?:string|null; unitPrice?:string|null; quantity:string; reorderPoint:string };
export type FleetAccount360 = {
  account: CustomerRow & { createdAt?:string; updatedAt?:string };
  summary:{ contacts:number; locations:number; vehicles:number; activeVehicles:number; maintenanceSchedules:number; dueMaintenance:number; openWorkOrders:number; inspections:number; activeRecommendations:number; outstandingBalance:string; lifetimeInvoiced:string; communicationThreads:number; sourceProspects:number; prospectActivities:number };
  contacts:Array<{id:string;name:string;email?:string|null;phone?:string|null;role?:string|null;isPrimary:boolean;tags?:string[];notes?:string|null}>;
  locations:Array<{id:string;name:string;address1:string;address2?:string|null;city:string;region:string;postalCode:string}>;
  vehicles:Array<{id:string;unitNumber:string;vin?:string|null;year?:number|null;make?:string|null;model?:string|null;mileage?:number|null;engineHours?:number|null;status:string;assignedDriver?:string|null;department?:string|null}>;
  workOrders:Array<{id:string;number:string;status:string;priority:string;scheduledAt?:string|null;requestedServices?:string[];purchaseOrderNumber?:string|null;updatedAt?:string}>;
  invoices:Array<{id:string;number:string;status:string;total:string;balanceDue:string;dueAt?:string|null;createdAt?:string}>;
  communications:Array<{id:string;subject?:string|null;workOrderId?:string|null;lastMessageAt?:string|null;updatedAt?:string}>;
  maintenanceSchedules:Array<{id:string;vehicleId:string;serviceCode:string;program?:string|null;nextDueAt?:string|null;nextDueMileage?:number|null;nextDueEngineHours?:number|null;active:boolean}>;
  dueMaintenance:Array<{id:string;vehicleId:string;serviceCode:string;nextDueAt?:string|null;nextDueMileage?:number|null;nextDueEngineHours?:number|null}>;
  inspections:Array<{id:string;workOrderId:string;status:string;createdAt?:string;items:Array<{id:string;name:string;condition:string;recommendation?:string|null}>}>;
  recommendations:Array<{id:string;inspectionId:string;name:string;condition:string;recommendation?:string|null;severity?:string|null}>;
  revenueHistory:Array<{prospect:{id:string;companyName:string;source?:string|null;sourceUrl?:string|null;convertedAt?:string|null;researchSummary?:string|null};contacts:Array<{id:string;name:string;email?:string|null;title?:string|null}>;activities:Array<{id:string;kind:string;direction?:string|null;channel?:string|null;subject?:string|null;summary?:string|null;occurredAt:string}>}>;
};

export type Vehicle360 = {
  vehicle:FleetAccount360['vehicles'][number]&{trim?:string|null;engine?:string|null;fuelType?:string|null;licensePlate?:string|null;registrationState?:string|null;notes?:string|null;specifications?:Record<string,unknown>};
  account:{id:string;name:string;accountNumber?:string|null;status:string}|null;
  location:FleetAccount360['locations'][number]|null;
  summary:{maintenanceSchedules:number;dueMaintenance:number;workOrders:number;openWorkOrders:number;inspections:number;recommendations:number};
  maintenanceSchedules:FleetAccount360['maintenanceSchedules'];
  maintenanceHistory:Array<{id:string;eventType:string;mileage?:number|null;occurredAt:string;notes?:string|null;workOrderId?:string|null}>;
  workOrders:FleetAccount360['workOrders'];
  inspections:FleetAccount360['inspections'];
  recommendations:FleetAccount360['recommendations'];
};

async function request<T>(path:string, init?:RequestInit):Promise<T> {
  const response=await fleetFetch(`/api/operations${path}`,init);
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||`Request failed (${response.status})`);
  return data;
}

export const operationsApi={
  customers:(search='')=>request<{customers:CustomerRow[]}>(`/customers?search=${encodeURIComponent(search)}`),
  customerOverview:(id:string)=>request<{account:FleetAccount360}>(`/customers/${encodeURIComponent(id)}/overview`),
  vehicleOverview:async(id:string)=>{const response=await fleetFetch(`/api/vehicles/${encodeURIComponent(id)}/overview`);const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);return data as {vehicle:Vehicle360}},
  createCustomer:(body:Record<string,unknown>)=>request('/customers',{method:'POST',body:JSON.stringify(body)}),
  updateCustomer:(id:string,body:Record<string,unknown>)=>request(`/customers/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)}),
  deleteCustomer:(id:string)=>request(`/customers/${encodeURIComponent(id)}`,{method:'DELETE'}),
  parts:(search='')=>request<{parts:PartRow[]}>(`/parts?search=${encodeURIComponent(search)}`),
  createPart:(body:Record<string,unknown>)=>request('/parts',{method:'POST',body:JSON.stringify(body)}),
  updatePart:(id:string,body:Record<string,unknown>)=>request(`/parts/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)}),
  updateInventory:(id:string,body:{quantity:number;reorderPoint:number})=>request(`/parts/${encodeURIComponent(id)}/inventory`,{method:'PUT',body:JSON.stringify(body)}),
  deletePart:(id:string)=>request(`/parts/${encodeURIComponent(id)}`,{method:'DELETE'}),
};
