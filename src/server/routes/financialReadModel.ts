import { Router } from 'express';
import { FleetAuthError, fleetAuthFailure, requireFleetOrganization } from '../services/fleetAuth.js';
import { financialReadModelService, FinancialReadModelError } from '../services/financialReadModel.js';

export const financialReadModelRouter = Router();

financialReadModelRouter.get('/financials/dashboard', async (req, res) => {
  try {
    const organizationId = await requireFleetOrganization(req);
    return res.json(await financialReadModelService.dashboard(organizationId));
  } catch (error) {
    if (error instanceof FleetAuthError) return fleetAuthFailure(res, error);
    const status = error instanceof FinancialReadModelError ? error.status : 500;
    return res.status(status).json({ error: error instanceof Error ? error.message : 'Financial dashboard failed' });
  }
});
