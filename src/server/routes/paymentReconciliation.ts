import { Router } from 'express';
import { FleetAuthError, fleetAuthFailure, requireFleetOrganization } from '../services/fleetAuth.js';
import { paymentReconciliationService, PaymentReconciliationError } from '../services/paymentReconciliation.js';

export const paymentReconciliationRouter = Router();

paymentReconciliationRouter.post('/invoices/:id/payments', async (req, res) => {
  try {
    const organizationId = await requireFleetOrganization(req);
    return res.status(201).json(await paymentReconciliationService.record(organizationId, req.params.id, req.body || {}));
  } catch (error) {
    if (error instanceof FleetAuthError) return fleetAuthFailure(res, error);
    const status = error instanceof PaymentReconciliationError ? error.status : 500;
    return res.status(status).json({ error: error instanceof Error ? error.message : 'Payment reconciliation failed' });
  }
});
