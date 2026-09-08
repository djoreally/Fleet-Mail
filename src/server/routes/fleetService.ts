import { Router } from 'express';
import { FleetAuthError, fleetAuthFailure, requireFleetOrganization, requireFleetPermission } from '../services/fleetAuth.js';
import { FleetServiceModelError, createCatalogService, createConnectedVehicle, createConnectedWorkOrder, createServiceAgreement, deleteInventoryPart, fleetServiceBootstrap, setAgreementService, setVehiclePart, setVehicleServiceProfile } from '../services/fleetServiceModel.js';
import { fleetAccount360Service } from '../services/fleetAccount360.js';

export const fleetServiceRouter=Router();
const fail=(res:any,error:unknown)=>{if(error instanceof FleetAuthError)return fleetAuthFailure(res,error);if(error instanceof FleetServiceModelError){console.warn('Fleet service operation rejected:',error.message);return res.status(error.status).json({error:error.message,code:'fleet_service_write_rejected'})}const message=error instanceof Error?error.message:'Fleet service operation failed';console.warn('Fleet service operation failed:',message);return res.status(/not found/i.test(message)?404:/duplicate|unique|already|belongs/i.test(message)?409:/required|invalid|must/i.test(message)?400:500).json({error:message,code:'fleet_service_write_failed'})};

function normalizeAgreementInput(input:Record<string,unknown>={}){
 const next={...input};
 if(typeof next.name==='string')next.name=next.name.trim();
 for(const [key,fallback] of [['slaHours',24],['approvalThreshold',500],['minDispatchBufferMinutes',15]] as const){
  const raw=next[key];const parsed=raw==null||raw===''?fallback:Number(String(raw).replace(/[$,]/g,''));next[key]=Number.isFinite(parsed)&&parsed>=0?parsed:fallback;
 }
 if(Number(next.slaHours)<=0)next.slaHours=24;
 for(const key of ['startDate','endDate','notes','invoiceGroup'] as const){if(typeof next[key]==='string'&&!String(next[key]).trim())next[key]=null;}
 next.approvalMode=String(next.approvalMode||'hybrid');
 next.billingModel=String(next.billingModel||'per_service');
 next.invoiceFrequency=String(next.invoiceFrequency||'monthly');
 next.paymentTerms=String(next.paymentTerms||'net_30');
 return next;
}

fleetServiceRouter.get('/bootstrap',async(req,res)=>{try{const org=await requireFleetOrganization(req);await requireFleetPermission(req,'fleet_accounts.view');return res.json(await fleetServiceBootstrap(org))}catch(e){return fail(res,e)}});
fleetServiceRouter.get('/account-overview',async(req,res)=>{try{const org=await requireFleetOrganization(req);await requireFleetPermission(req,'fleet_accounts.view');const id=String(req.query.id??'').trim();if(!id)return res.status(400).json({error:'Fleet account id is required'});return res.json({account:await fleetAccount360Service.get(org,id)})}catch(e){return fail(res,e)}});
fleetServiceRouter.post('/vehicles',async(req,res)=>{try{const org=await requireFleetOrganization(req);await requireFleetPermission(req,'vehicles.manage');return res.status(201).json({vehicle:await createConnectedVehicle(org,req.body??{})})}catch(e){return fail(res,e)}});
fleetServiceRouter.post('/work-orders',async(req,res)=>{try{const org=await requireFleetOrganization(req);await requireFleetPermission(req,'work_orders.manage');return res.status(201).json({workOrder:await createConnectedWorkOrder(org,req.body??{})})}catch(e){return fail(res,e)}});
fleetServiceRouter.post('/catalog',async(req,res)=>{try{const org=await requireFleetOrganization(req);await requireFleetPermission(req,'agreements.manage');return res.status(201).json({service:await createCatalogService(org,req.body??{})})}catch(e){return fail(res,e)}});
fleetServiceRouter.post('/agreements',async(req,res)=>{try{const org=await requireFleetOrganization(req);await requireFleetPermission(req,'agreements.manage');return res.status(201).json({agreement:await createServiceAgreement(org,normalizeAgreementInput(req.body??{}))})}catch(e){return fail(res,e)}});
fleetServiceRouter.put('/agreements/:agreementId/services/:serviceId',async(req,res)=>{try{const org=await requireFleetOrganization(req);await requireFleetPermission(req,'agreements.manage');return res.json({pricing:await setAgreementService(org,req.params.agreementId,req.params.serviceId,req.body??{})})}catch(e){return fail(res,e)}});
fleetServiceRouter.put('/vehicles/:vehicleId/parts/:partId',async(req,res)=>{try{const org=await requireFleetOrganization(req);await requireFleetPermission(req,'vehicles.manage');return res.json({vehiclePart:await setVehiclePart(org,req.params.vehicleId,req.params.partId,req.body??{})})}catch(e){return fail(res,e)}});
fleetServiceRouter.put('/vehicles/:vehicleId/services/:serviceId',async(req,res)=>{try{const org=await requireFleetOrganization(req);await requireFleetPermission(req,'vehicles.manage');return res.json({profile:await setVehicleServiceProfile(org,req.params.vehicleId,req.params.serviceId,req.body??{})})}catch(e){return fail(res,e)}});
fleetServiceRouter.delete('/parts/:partId',async(req,res)=>{try{const org=await requireFleetOrganization(req);await requireFleetPermission(req,'work_orders.manage');return res.json(await deleteInventoryPart(org,req.params.partId))}catch(e){return fail(res,e)}});
