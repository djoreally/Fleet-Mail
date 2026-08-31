import { Router } from 'express';
import { operationsDataService } from '../services/operationsData.js';
import { FleetAuthError, fleetAuthFailure, requireFleetOrganization } from '../services/fleetAuth.js';

export const customerPartsRouter = Router();

const fail = (res: any, error: unknown) => {
  if (error instanceof FleetAuthError) return fleetAuthFailure(res, error);
  const message = error instanceof Error ? error.message : 'Operation failed';
  return res.status(/not found/i.test(message) ? 404 : /required|must|numeric/i.test(message) ? 400 : 500).json({ error: message });
};
customerPartsRouter.get('/customers', async (req,res)=>{try{const org=await requireFleetOrganization(req);return res.json({customers:await operationsDataService.listCustomers(org,String(req.query.search??''))})}catch(e){return fail(res,e)}});
customerPartsRouter.post('/customers', async (req,res)=>{try{const org=await requireFleetOrganization(req);return res.status(201).json({customer:await operationsDataService.createCustomer(org,req.body??{})})}catch(e){return fail(res,e)}});
customerPartsRouter.put('/customers/:id', async (req,res)=>{try{const org=await requireFleetOrganization(req);return res.json({customer:await operationsDataService.updateCustomer(org,req.params.id,req.body??{})})}catch(e){return fail(res,e)}});
customerPartsRouter.delete('/customers/:id', async (req,res)=>{try{const org=await requireFleetOrganization(req);return res.json({deleted:await operationsDataService.deleteCustomer(org,req.params.id)})}catch(e){return fail(res,e)}});
customerPartsRouter.get('/parts', async (req,res)=>{try{const org=await requireFleetOrganization(req);return res.json({parts:await operationsDataService.listParts(org,String(req.query.search??''))})}catch(e){return fail(res,e)}});
customerPartsRouter.post('/parts', async (req,res)=>{try{const org=await requireFleetOrganization(req);return res.status(201).json({part:await operationsDataService.createPart(org,req.body??{})})}catch(e){return fail(res,e)}});
customerPartsRouter.put('/parts/:id', async (req,res)=>{try{const org=await requireFleetOrganization(req);return res.json({part:await operationsDataService.updatePart(org,req.params.id,req.body??{})})}catch(e){return fail(res,e)}});
customerPartsRouter.put('/parts/:id/inventory', async (req,res)=>{try{const org=await requireFleetOrganization(req);return res.json({inventory:await operationsDataService.adjustInventory(org,req.params.id,req.body?.quantity,req.body?.reorderPoint)})}catch(e){return fail(res,e)}});
customerPartsRouter.delete('/parts/:id', async (req,res)=>{try{const org=await requireFleetOrganization(req);return res.json({deleted:await operationsDataService.deletePart(org,req.params.id)})}catch(e){return fail(res,e)}});
