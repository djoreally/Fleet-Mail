import { Router } from 'express';
import { createDocument, createInvoice, deleteDocument, financialOverview, FinancialDocumentsError, listDocuments } from '../services/financialDocuments.js';
import { fleetAuthFailure, requireFleetOrganization } from '../services/fleetAuth.js';

export const financialDocumentsRouter = Router();
const handle = (res: any, error: unknown) => {
  if (!(error instanceof FinancialDocumentsError)) return fleetAuthFailure(res, error);
  const status = error instanceof FinancialDocumentsError ? error.status : 500;
  res.status(status).json({ error: error instanceof Error ? error.message : 'Request failed' });
};

financialDocumentsRouter.get('/financials', async (req, res) => {
  try { res.json(await financialOverview(await requireFleetOrganization(req))); } catch (error) { handle(res, error); }
});
financialDocumentsRouter.post('/invoices', async (req, res) => {
  try { res.status(201).json({ invoice: await createInvoice(await requireFleetOrganization(req), req.body || {}) }); } catch (error) { handle(res, error); }
});
financialDocumentsRouter.get('/documents', async (req, res) => {
  try { res.json({ documents: await listDocuments(await requireFleetOrganization(req)) }); } catch (error) { handle(res, error); }
});
financialDocumentsRouter.post('/documents', async (req, res) => {
  try { res.status(201).json({ document: await createDocument(await requireFleetOrganization(req), req.body || {}) }); } catch (error) { handle(res, error); }
});
financialDocumentsRouter.delete('/documents/:id', async (req, res) => {
  try { res.json({ deleted: await deleteDocument(await requireFleetOrganization(req), req.params.id) }); } catch (error) { handle(res, error); }
});
