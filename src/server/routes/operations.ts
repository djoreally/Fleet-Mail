import { Router } from 'express';
import { completeMaintenance, createMaintenanceSchedule, createWorkOrder, deleteWorkOrder, listMaintenance, listWorkOrders, updateWorkOrder } from '../services/operationsPersistence.js';
import { getTechnicianWorkOrderContext } from '../services/technicianContext.js';
import { FleetAuthError, fleetAuthFailure, requireFleetOrganization, requireFleetPermission } from '../services/fleetAuth.js';
import { assertAssignedWorkOrder, getTechnicianScope } from '../services/technicianAccess.js';
import { assertWorkOrderDeletable, sanitizeWorkOrderManagementPatch } from '../services/workOrderManagementGuard.js';

export const operationsRouter = Router();

function failure(res: Parameters<typeof fleetAuthFailure>[0], error: unknown) {
  if (error instanceof FleetAuthError) return fleetAuthFailure(res, error);
  const message = error instanceof Error ? error.message : 'Operations request failed';
  const status = /required|invalid|lifecycle|cannot|only draft|execution history/i.test(message) ? 400 : /not found/i.test(message) ? 404 : 500;
  return res.status(status).json({ error: message });
}

operationsRouter.get('/work-orders', async (req, res) => {
  try {
    const organizationId = await requireFleetOrganization(req);
    await requireFleetPermission(req, 'work_orders.view');
    const scope = await getTechnicianScope(req, organizationId);
    const rows = await listWorkOrders(organizationId);
    const workOrders = scope.isTechnician ? rows.filter(row => row.technicianId === scope.technicianId) : rows;
    res.json({ organizationId, workOrders });
  } catch (error) { failure(res, error); }
});
operationsRouter.get('/work-orders/:id/technician-context', async (req, res) => {
  try { const organizationId = await requireFleetOrganization(req); await requireFleetPermission(req, 'work_orders.view'); await assertAssignedWorkOrder(req, organizationId, req.params.id); res.json(await getTechnicianWorkOrderContext(organizationId, req.params.id)); }
  catch (error) { failure(res, error); }
});
operationsRouter.post('/work-orders', async (req, res) => {
  try { const organizationId = await requireFleetOrganization(req); await requireFleetPermission(req, 'work_orders.manage'); res.status(201).json({ workOrder: await createWorkOrder(organizationId, req.body ?? {}) }); }
  catch (error) { failure(res, error); }
});
operationsRouter.patch('/work-orders/:id', async (req, res) => {
  try { const organizationId = await requireFleetOrganization(req); await requireFleetPermission(req, 'work_orders.manage'); const patch=sanitizeWorkOrderManagementPatch(req.body ?? {}); res.json({ workOrder: await updateWorkOrder(organizationId, req.params.id, patch) }); }
  catch (error) { failure(res, error); }
});
operationsRouter.delete('/work-orders/:id', async (req, res) => {
  try { const organizationId = await requireFleetOrganization(req); await requireFleetPermission(req, 'work_orders.manage'); await assertWorkOrderDeletable(organizationId,req.params.id); res.json({ deleted: await deleteWorkOrder(organizationId, req.params.id) }); }
  catch (error) { failure(res, error); }
});
operationsRouter.get('/maintenance', async (req, res) => {
  try { const organizationId = await requireFleetOrganization(req); await requireFleetPermission(req, 'work_orders.view'); const scope=await getTechnicianScope(req,organizationId); const schedules=await listMaintenance(organizationId); res.json({ organizationId, schedules: scope.isTechnician ? [] : schedules }); }
  catch (error) { failure(res, error); }
});
operationsRouter.post('/maintenance', async (req, res) => {
  try { const organizationId = await requireFleetOrganization(req); await requireFleetPermission(req, 'work_orders.manage'); res.status(201).json({ schedule: await createMaintenanceSchedule(organizationId, req.body ?? {}) }); }
  catch (error) { failure(res, error); }
});
operationsRouter.post('/maintenance/:id/complete', async (req, res) => {
  try { const organizationId = await requireFleetOrganization(req); await requireFleetPermission(req, 'work_orders.execute'); if(req.body?.workOrderId) await assertAssignedWorkOrder(req,organizationId,String(req.body.workOrderId)); res.status(201).json({ event: await completeMaintenance(organizationId, req.params.id, req.body ?? {}) }); }
  catch (error) { failure(res, error); }
});
