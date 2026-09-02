import { Router } from 'express';
import { FleetAuthError, fleetAuthFailure, requireFleetOrganization } from '../services/fleetAuth.js';
import { workOrderCompletionService } from '../services/workOrderCompletion.js';

export const workOrderCompletionRouter = Router();

workOrderCompletionRouter.post('/work-orders/:id/complete-validated', async (req, res) => {
  try {
    const organizationId = await requireFleetOrganization(req);
    return res.json({ workOrder: await workOrderCompletionService.complete(organizationId, req.params.id) });
  } catch (error) {
    if (error instanceof FleetAuthError) return fleetAuthFailure(res, error);
    const message = error instanceof Error ? error.message : 'Work-order completion failed';
    const status = /not found/i.test(message) ? 404 : /required|must|cannot|pending|unresolved|completed|cancelled|completable/i.test(message) ? 400 : 500;
    return res.status(status).json({ error: message });
  }
});
