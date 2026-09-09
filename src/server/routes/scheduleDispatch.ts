import { Router, type Request, type Response } from 'express';
import { FleetOperationsError, ScheduleDispatchService } from '../services/scheduleDispatch.js';
import { fleetAuthFailure, getFleetAccessContext, requireFleetOrganization, requireFleetPermission } from '../services/fleetAuth.js';
import { syncDispatchTechnician, syncWorkOrderSchedule, syncWorkOrderTechnician, workOrderChain } from '../services/fleetServiceModel.js';
import { recordDispatchCreated, transitionDispatchStatus } from '../services/dispatchLifecycle.js';

export const scheduleDispatchRouter = Router();
const service = new ScheduleDispatchService();
const context = async (req: Request) => ({ organizationId: await requireFleetOrganization(req), authorization: req.header('authorization') });
const run = (handler: (req: Request) => Promise<unknown>, created = false) => async (req: Request, res: Response) => { try { const result = await handler(req); return res.status(created ? 201 : 200).json(result); } catch (error) { if (error instanceof FleetOperationsError) return res.status(error.status).json({ error: error.message }); return fleetAuthFailure(res, error); } };

async function createAppointmentForWorkOrder(req:Request,workOrderId:string){
 await requireFleetPermission(req,'schedule.manage');
 const c=await context(req);
 const chain=await workOrderChain(c.organizationId,workOrderId);
 const result=await service.createAppointment(c.organizationId,c.authorization,{...(req.body??{}),workOrderId:chain.id,customerId:chain.customer_id,vehicleId:chain.vehicle_id,locationId:req.body?.locationId||chain.location_id||null,status:'scheduled'});
 await syncWorkOrderSchedule(c.organizationId,workOrderId,req.body?.startsAt);
 return result;
}

scheduleDispatchRouter.get('/appointments', run(async req=>{await requireFleetPermission(req, 'schedule.view');const c=await context(req);return service.listAppointments(c.organizationId,c.authorization,req.query.from,req.query.to)}));
// Canonical scheduling command: the Work Order URL owns customer/vehicle relationship state.
scheduleDispatchRouter.post('/work-orders/:workOrderId/appointment',run(async req=>createAppointmentForWorkOrder(req,req.params.workOrderId),true));
// Backward compatibility for older clients.
scheduleDispatchRouter.post('/appointments', run(async req=>{const workOrderId=String(req.body?.workOrderId||'');if(!workOrderId)throw new FleetOperationsError('workOrderId is required',400);return createAppointmentForWorkOrder(req,workOrderId)},true));
scheduleDispatchRouter.patch('/appointments/:id', run(async req=>{await requireFleetPermission(req, 'schedule.manage');const c=await context(req);const body={...(req.body??{})};if(body.workOrderId){const chain=await workOrderChain(c.organizationId,String(body.workOrderId));Object.assign(body,{workOrderId:chain.id,customerId:chain.customer_id,vehicleId:chain.vehicle_id});}return service.updateAppointment(c.organizationId,c.authorization,req.params.id,body)}));
scheduleDispatchRouter.delete('/appointments/:id', run(async req=>{await requireFleetPermission(req, 'schedule.manage');const c=await context(req);return service.deleteAppointment(c.organizationId,c.authorization,req.params.id)}));

scheduleDispatchRouter.get('/dispatch', run(async req=>{await requireFleetPermission(req, 'dispatch.view');const c=await context(req);return service.listDispatch(c.organizationId,c.authorization)}));
scheduleDispatchRouter.post('/dispatch', run(async req=>{await requireFleetPermission(req, 'dispatch.manage');const c=await context(req);const access=await getFleetAccessContext(req);const result=await service.createDispatch(c.organizationId,c.authorization,{...(req.body??{}),status:'assigned'});await syncWorkOrderTechnician(c.organizationId,String(req.body?.workOrderId||''),String(req.body?.technicianId||''));const row=Array.isArray(result)?result[0]:result;if(row?.id)await recordDispatchCreated({organizationId:c.organizationId,dispatchId:String(row.id),actorUserId:access.userId});return result},true));
scheduleDispatchRouter.patch('/dispatch/:id/status', run(async req=>{await requireFleetPermission(req, 'dispatch.manage');const c=await context(req);const access=await getFleetAccessContext(req);const nextStatus=String(req.body?.status||'');if(!nextStatus)throw new FleetOperationsError('status is required',400);return transitionDispatchStatus({organizationId:c.organizationId,dispatchId:req.params.id,nextStatus,actorUserId:access.userId,notes:req.body?.notes?String(req.body.notes):null})}));
scheduleDispatchRouter.patch('/dispatch/:id', run(async req=>{await requireFleetPermission(req, 'dispatch.manage');if(req.body?.status!==undefined)throw new FleetOperationsError('Use the dispatch status transition endpoint for lifecycle changes',409);const c=await context(req);const result=await service.updateDispatch(c.organizationId,c.authorization,req.params.id,req.body??{});await syncDispatchTechnician(c.organizationId,req.params.id);return result}));
scheduleDispatchRouter.delete('/dispatch/:id', run(async req=>{await requireFleetPermission(req, 'dispatch.manage');throw new FleetOperationsError('Dispatch assignments are historical records. Cancel the dispatch instead of deleting it.',409)}));
scheduleDispatchRouter.get('/references', run(async req=>{await requireFleetPermission(req, 'dispatch.view');const c=await context(req);return service.references(c.organizationId,c.authorization)}));
