import { Router, type Request, type Response } from 'express';
import { FleetOperationsError, ScheduleDispatchService } from '../services/scheduleDispatch.js';
import { fleetAuthFailure, requireFleetOrganization } from '../services/fleetAuth.js';

export const scheduleDispatchRouter = Router();
const service = new ScheduleDispatchService();

const context = async (req: Request) => ({
  organizationId: await requireFleetOrganization(req),
  authorization: req.header('authorization'),
});

const run = (handler: (req: Request) => Promise<unknown>, created = false) => async (req: Request, res: Response) => {
  try {
    const result = await handler(req);
    return res.status(created ? 201 : 200).json(result);
  } catch (error) {
    if (error instanceof FleetOperationsError) return res.status(error.status).json({ error: error.message });
    return fleetAuthFailure(res, error);
  }
};

scheduleDispatchRouter.get('/appointments', run(async (req) => {
  const c = await context(req);
  return service.listAppointments(c.organizationId, c.authorization, req.query.from, req.query.to);
}));
scheduleDispatchRouter.post('/appointments', run(async (req) => {
  const c = await context(req);
  return service.createAppointment(c.organizationId, c.authorization, req.body ?? {});
}, true));
scheduleDispatchRouter.patch('/appointments/:id', run(async (req) => {
  const c = await context(req);
  return service.updateAppointment(c.organizationId, c.authorization, req.params.id, req.body ?? {});
}));
scheduleDispatchRouter.delete('/appointments/:id', run(async (req) => {
  const c = await context(req);
  return service.deleteAppointment(c.organizationId, c.authorization, req.params.id);
}));

scheduleDispatchRouter.get('/dispatch', run(async (req) => {
  const c = await context(req);
  return service.listDispatch(c.organizationId, c.authorization);
}));
scheduleDispatchRouter.post('/dispatch', run(async (req) => {
  const c = await context(req);
  return service.createDispatch(c.organizationId, c.authorization, req.body ?? {});
}, true));
scheduleDispatchRouter.patch('/dispatch/:id', run(async (req) => {
  const c = await context(req);
  return service.updateDispatch(c.organizationId, c.authorization, req.params.id, req.body ?? {});
}));
scheduleDispatchRouter.delete('/dispatch/:id', run(async (req) => {
  const c = await context(req);
  return service.deleteDispatch(c.organizationId, c.authorization, req.params.id);
}));

scheduleDispatchRouter.get('/references', run(async (req) => {
  const c = await context(req);
  return service.references(c.organizationId, c.authorization);
}));
