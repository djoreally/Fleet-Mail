import { Router } from 'express';
import { FleetAuthError, fleetAuthFailure, requireFleetOrganization } from '../services/fleetAuth.js';
import { maintenanceIntelligenceService } from '../services/maintenanceIntelligence.js';

export const maintenanceIntelligenceRouter = Router();

maintenanceIntelligenceRouter.get('/maintenance/attention', async (req, res) => {
  try {
    const organizationId = await requireFleetOrganization(req);
    return res.json(await maintenanceIntelligenceService.attention(organizationId));
  } catch (error) {
    if (error instanceof FleetAuthError) return fleetAuthFailure(res, error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Maintenance intelligence failed' });
  }
});
