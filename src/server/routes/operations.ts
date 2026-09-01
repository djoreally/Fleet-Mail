import { Router } from 'express';
import { completeMaintenance, createMaintenanceSchedule, createWorkOrder, deleteWorkOrder, listMaintenance, listWorkOrders, updateWorkOrder } from '../services/operationsPersistence.js';
import { getTechnicianWorkOrderContext } from '../services/technicianContext.js';
import { FleetAuthError, fleetAuthFailure, requireFleetOrganization } from '../services/fleetAuth.js';

export const operationsRouter = Router();

function failure(res: Parameters<typeof fleetAuthFailure>[0], error: unknown) {
  if (error instanceof FleetAuthError) return fleetAuthFailure(res, error);
  const message = error instanceof Error ? error.message : 'Operations request failed';
  const status = /required|invalid/i.test(message) ? 400 : /not found/i.test(message) ? 404 : 500;
  return res.status(status).json({ error: message });
}

operationsRouter.get('/work-orders', async (req, res) => {
  try { const organizationId = await requireFleetOrganization(req); res.json({ organizationId, workOrders: await listWorkOrders(organizationId) }); }
  catch (error) { failure(res, error); }
});
operationsRouter.get('/work-orders/:id/technician-context', async (req, res) => {
  try { const organizationId = await requireFleetOrganization(req); res.json(await getTechnicianWorkOrderContext(organizationId, req.params.id)); }
  catch (error) { failure(res, error); }
});
operationsRouter.post('/work-orders', async (req, res) => {
  try { const organizationId = await requireFleetOrganization(req); res.status(201).json({ workOrder: await createWorkOrder(organizationId, req.body ?? {}) }); }
  catch (error) { failure(res, error); }
});
operationsRouter.patch('/work-orders/:id', async (req, res) => {
  try { const organizationId = await requireFleetOrganization(req); res.json({ workOrder: await updateWorkOrder(organizationId, req.params.id, req.body ?? {}) }); }
  catch (error) { failure(res, error); }
});
operationsRouter.delete('/work-orders/:id', async (req, res) => {
  try { const organizationId = await requireFleetOrganization(req); res.json({ deleted: await deleteWorkOrder(organizationId, req.params.id) }); }
  catch (error) { failure(res, error); }
});
operationsRouter.get('/maintenance', async (req, res) => {
  try { const organizationId = await requireFleetOrganization(req); res.json({ organizationId, schedules: await listMaintenance(organizationId) }); }
  catch (error) { failure(res, error); }
});
operationsRouter.post('/maintenance', async (req, res) => {
  try { const organizationId = await requireFleetOrganization(req); res.status(201).json({ schedule: await createMaintenanceSchedule(organizationId, req.body ?? {}) }); }
  catch (error) { failure(res, error); }
});
operationsRouter.post('/maintenance/:id/complete', async (req, res) => {
  try { const organizationId = await requireFleetOrganization(req); res.status(201).json({ event: await completeMaintenance(organizationId, req.params.id, req.body ?? {}) }); }
  catch (error) { failure(res, error); }
});
