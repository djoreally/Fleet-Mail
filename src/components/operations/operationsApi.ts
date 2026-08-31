import { fleetFetch } from '../../lib/fleetApi';

export type CustomerRow = { id:string; name:string; accountNumber?:string|null; billingEmail?:string|null; phone?:string|null; notes?:string|null; status:string; vehicleCount:number; primaryContact?:string|null; contactEmail?:string|null; spend30Days:string };
export type PartRow = { id:string; sku:string; name:string; description?:string|null; unitCost?:string|null; unitPrice?:string|null; quantity:string; reorderPoint:string };

async function request<T>(path:string, init?:RequestInit):Promise<T> {
  const response=await fleetFetch(`/api/operations${path}`,init);
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||`Request failed (${response.status})`);
  return data;
}

export const operationsApi={
  customers:(search='')=>request<{customers:CustomerRow[]}>(`/customers?search=${encodeURIComponent(search)}`),
  createCustomer:(body:Record<string,unknown>)=>request('/customers',{method:'POST',body:JSON.stringify(body)}),
  updateCustomer:(id:string,body:Record<string,unknown>)=>request(`/customers/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)}),
  deleteCustomer:(id:string)=>request(`/customers/${encodeURIComponent(id)}`,{method:'DELETE'}),
  parts:(search='')=>request<{parts:PartRow[]}>(`/parts?search=${encodeURIComponent(search)}`),
  createPart:(body:Record<string,unknown>)=>request('/parts',{method:'POST',body:JSON.stringify(body)}),
  updatePart:(id:string,body:Record<string,unknown>)=>request(`/parts/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)}),
  updateInventory:(id:string,body:{quantity:number;reorderPoint:number})=>request(`/parts/${encodeURIComponent(id)}/inventory`,{method:'PUT',body:JSON.stringify(body)}),
  deletePart:(id:string)=>request(`/parts/${encodeURIComponent(id)}`,{method:'DELETE'}),
};
