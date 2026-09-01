import { Router } from 'express';
import { FleetAuthError, fleetAuthFailure, requireFleetOrganization } from '../services/fleetAuth.js';
import { vehicle360Service } from '../services/vehicle360.js';

export const vehicle360Router = Router();

vehicle360Router.get('/vehicles/:id/overview', async (req, res) => {
  try {
    const organizationId = await requireFleetOrganization(req);
    return res.json({ vehicle: await vehicle360Service.get(organizationId, req.params.id) });
  } catch (error) {
    if (error instanceof FleetAuthError) return fleetAuthFailure(res, error);
    const message = error instanceof Error ? error.message : 'Vehicle overview failed';
    return res.status(/not found/i.test(message) ? 404 : 500).json({ error: message });
  }
});
