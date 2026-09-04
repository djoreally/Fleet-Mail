import { Router } from 'express';
import { FleetAuthError, fleetAuthFailure, requireFleetOrganization, requireFleetPermission } from '../services/fleetAuth.js';
import { assertAssignedSubresource, assertAssignedWorkOrder } from '../services/technicianAccess.js';
import { workOrderExecutionService } from '../services/workOrderExecution.js';

export const workOrderExecutionRouter = Router();

const fail = (res: any, error: unknown) => {
  if (error instanceof FleetAuthError) return fleetAuthFailure(res, error);
  const message = error instanceof Error ? error.message : 'Work-order execution failed';
  const status = /not found/i.test(message) ? 404 : /required|must|invalid|cannot|closed|immutable|ready|already/i.test(message) ? 400 : 500;
  return res.status(status).json({ error: message });
};

workOrderExecutionRouter.get('/work-orders/:id/execution', async (req,res)=>{
  try { const org=await requireFleetOrganization(req); await requireFleetPermission(req,'work_orders.view'); await assertAssignedWorkOrder(req,org,req.params.id); return res.json({ execution:await workOrderExecutionService.get(org,req.params.id) }); }
  catch(error){ return fail(res,error); }
});
workOrderExecutionRouter.post('/work-orders/:id/transition', async (req,res)=>{
  try { const org=await requireFleetOrganization(req); await requireFleetPermission(req,'work_orders.execute'); await assertAssignedWorkOrder(req,org,req.params.id); return res.json({ workOrder:await workOrderExecutionService.transition(org,req.params.id,String(req.body?.status||'')) }); }
  catch(error){ return fail(res,error); }
});
workOrderExecutionRouter.post('/work-orders/:id/inspections', async (req,res)=>{
  try { const org=await requireFleetOrganization(req); await requireFleetPermission(req,'inspections.execute'); await assertAssignedWorkOrder(req,org,req.params.id); return res.status(201).json({ inspection:await workOrderExecutionService.startInspection(org,req.params.id,req.body??{}) }); }
  catch(error){ return fail(res,error); }
});
workOrderExecutionRouter.post('/inspections/:id/items', async (req,res)=>{
  try { const org=await requireFleetOrganization(req); await requireFleetPermission(req,'inspections.execute'); await assertAssignedSubresource(req,org,'inspection',req.params.id); return res.status(201).json({ item:await workOrderExecutionService.addInspectionItem(org,req.params.id,req.body??{}) }); }
  catch(error){ return fail(res,error); }
});
workOrderExecutionRouter.patch('/inspection-items/:id', async (req,res)=>{
  try { const org=await requireFleetOrganization(req); await requireFleetPermission(req,'inspections.execute'); await assertAssignedSubresource(req,org,'inspection_item',req.params.id); return res.json({ item:await workOrderExecutionService.updateInspectionItem(org,req.params.id,req.body??{}) }); }
  catch(error){ return fail(res,error); }
});
workOrderExecutionRouter.post('/inspections/:id/complete', async (req,res)=>{
  try { const org=await requireFleetOrganization(req); await requireFleetPermission(req,'inspections.execute'); await assertAssignedSubresource(req,org,'inspection',req.params.id); return res.json(await workOrderExecutionService.completeInspection(org,req.params.id)); }
  catch(error){ return fail(res,error); }
});
workOrderExecutionRouter.post('/work-orders/:id/authorizations', async (req,res)=>{
  try { const org=await requireFleetOrganization(req); await requireFleetPermission(req,'work_orders.execute'); await assertAssignedWorkOrder(req,org,req.params.id); return res.status(201).json({ authorization:await workOrderExecutionService.createAuthorization(org,req.params.id,req.body??{}) }); }
  catch(error){ return fail(res,error); }
});
workOrderExecutionRouter.post('/authorizations/:id/decision', async (req,res)=>{
  try {
    const org=await requireFleetOrganization(req); await requireFleetPermission(req,'authorizations.manage');
    const decision=String(req.body?.decision||'');
    if(decision!=='authorized'&&decision!=='rejected') return res.status(400).json({error:'decision must be authorized or rejected'});
    return res.json({ authorization:await workOrderExecutionService.decideAuthorization(org,req.params.id,decision,req.body??{}) });
  } catch(error){ return fail(res,error); }
});
workOrderExecutionRouter.post('/work-orders/:id/service-lines', async (req,res)=>{
  try { const org=await requireFleetOrganization(req); await requireFleetPermission(req,'work_orders.execute'); await assertAssignedWorkOrder(req,org,req.params.id); return res.status(201).json({ serviceLine:await workOrderExecutionService.addServiceLine(org,req.params.id,req.body??{}) }); }
  catch(error){ return fail(res,error); }
});
workOrderExecutionRouter.post('/service-lines/:id/complete', async (req,res)=>{
  try { const org=await requireFleetOrganization(req); await requireFleetPermission(req,'work_orders.execute'); await assertAssignedSubresource(req,org,'service_line',req.params.id); return res.json({ serviceLine:await workOrderExecutionService.completeServiceLine(org,req.params.id) }); }
  catch(error){ return fail(res,error); }
});
workOrderExecutionRouter.post('/work-orders/:id/parts', async (req,res)=>{
  try { const org=await requireFleetOrganization(req); await requireFleetPermission(req,'work_orders.execute'); await assertAssignedWorkOrder(req,org,req.params.id); return res.status(201).json({ partUsage:await workOrderExecutionService.addPartUsage(org,req.params.id,req.body??{}) }); }
  catch(error){ return fail(res,error); }
});
workOrderExecutionRouter.post('/work-orders/:id/fluids', async (req,res)=>{
  try { const org=await requireFleetOrganization(req); await requireFleetPermission(req,'work_orders.execute'); await assertAssignedWorkOrder(req,org,req.params.id); return res.status(201).json({ fluidUsage:await workOrderExecutionService.addFluidUsage(org,req.params.id,req.body??{}) }); }
  catch(error){ return fail(res,error); }
});
