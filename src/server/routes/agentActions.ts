import { Router } from 'express';
import { serverConfig } from '../config.js';
import { getAgentMailClient } from '../services/agentmail.js';
import { createAgentActionProposal, verifyAgentActionProposal } from '../services/agentActions.js';
import { googleFetch } from '../services/googleOAuth.js';
import { createWorkOrder, deleteWorkOrder, updateWorkOrder } from '../services/operationsPersistence.js';
import { operationsDataService } from '../services/operationsData.js';
import { requireFleetOrganization, fleetAuthFailure } from '../services/fleetAuth.js';
import { readGoogleTokens, writeGoogleTokens } from './google.js';

export const agentActionsRouter = Router();
const consumedProposals = new Set<string>();
const processingProposals = new Set<string>();

agentActionsRouter.post('/propose', async (req, res) => {
  try {
    const organizationId = await requireFleetOrganization(req);
    return res.status(201).json(createAgentActionProposal(req.body?.kind, req.body?.payload, organizationId));
  } catch (error) {
    return fleetAuthFailure(res, error);
  }
});

agentActionsRouter.post('/execute', async (req, res) => {
  if (req.body?.confirmed !== true) return res.status(409).json({ error: 'Explicit confirmation is required' });
  let proposalId = '';
  try {
    const organizationId = await requireFleetOrganization(req);
    const proposal = verifyAgentActionProposal(req.body?.confirmationToken);
    proposalId = proposal.id;
    if (proposal.organizationId !== organizationId) return res.status(403).json({ error: 'This action belongs to a different organization' });
    if (consumedProposals.has(proposal.id) || processingProposals.has(proposal.id)) return res.status(409).json({ error: 'This action was already executed' });
    processingProposals.add(proposal.id);

    let result: unknown;
    if (proposal.kind === 'email.send') {
      const client = getAgentMailClient() as any;
      if (!client) return res.status(503).json({ error: 'AgentMail is not configured' });
      result = await client.inboxes.messages.send(serverConfig.defaultInbox, proposal.payload);
    } else if (proposal.kind === 'calendar.create') {
      const tokens = readGoogleTokens(req);
      if (!tokens) return res.status(401).json({ error: 'Connect Google before creating calendar events' });
      const calendar = await googleFetch<any>('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', tokens, { method: 'POST', body: JSON.stringify(proposal.payload) });
      writeGoogleTokens(res, calendar.tokens);
      result = calendar.data;
    } else if (proposal.kind === 'customer.create') {
      result = await operationsDataService.createCustomer(organizationId, proposal.payload);
    } else if (proposal.kind === 'customer.update') {
      result = await operationsDataService.updateCustomer(organizationId, String(proposal.payload.id), proposal.payload);
    } else if (proposal.kind === 'customer.delete') {
      result = { deleted: await operationsDataService.deleteCustomer(organizationId, String(proposal.payload.id)) };
    } else if (proposal.kind === 'work-order.create') {
      result = await createWorkOrder(organizationId, proposal.payload);
    } else if (proposal.kind === 'work-order.update') {
      result = await updateWorkOrder(organizationId, String(proposal.payload.id), proposal.payload);
    } else if (proposal.kind === 'work-order.delete') {
      result = { deleted: await deleteWorkOrder(organizationId, String(proposal.payload.id)) };
    }
    consumedProposals.add(proposal.id);
    return res.json({ executed: true, proposalId: proposal.id, kind: proposal.kind, result });
  } catch (error) {
    return fleetAuthFailure(res, error);
  } finally {
    if (proposalId) processingProposals.delete(proposalId);
  }
});
