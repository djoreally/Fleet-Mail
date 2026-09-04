import { Router } from 'express';
import { FleetAuthError, fleetAuthFailure, requireFleetOrganization, requireFleetPermission } from '../services/fleetAuth.js';
import { assertAssignedWorkOrder } from '../services/technicianAccess.js';
import { workOrderCompletionService } from '../services/workOrderCompletion.js';

export const workOrderCompletionRouter = Router();

const complete = async (req: any, res: any) => {
  try {
    const organizationId = await requireFleetOrganization(req);
    await requireFleetPermission(req, 'work_orders.execute');
    await assertAssignedWorkOrder(req, organizationId, req.params.id);
    return res.json({ workOrder: await workOrderCompletionService.complete(organizationId, req.params.id) });
  } catch (error) {
    if (error instanceof FleetAuthError) return fleetAuthFailure(res, error);
    const message = error instanceof Error ? error.message : 'Work-order completion failed';
    const status = /not found/i.test(message) ? 404 : /required|must|cannot|pending|unresolved|completed|cancelled|completable/i.test(message) ? 400 : 500;
    return res.status(status).json({ error: message });
  }
};

workOrderCompletionRouter.post('/work-orders/:id/transition', async (req, res, next) => {
  const status = String(req.body?.status || '');
  if (status !== 'complete' && status !== 'completed') return next();
  return complete(req, res);
});

workOrderCompletionRouter.post('/work-orders/:id/complete-validated', complete);
