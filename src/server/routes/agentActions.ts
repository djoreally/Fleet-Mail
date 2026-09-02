import { Router } from 'express';
import { serverConfig } from '../config.js';
import { getAgentMailClient } from '../services/agentmail.js';
import { createAgentActionProposal, verifyAgentActionProposal } from '../services/agentActions.js';
import { googleFetch } from '../services/googleOAuth.js';
import { readGoogleTokens, writeGoogleTokens } from './google.js';
import { FleetAuthError, fleetAuthFailure, requireFleetOrganization } from '../services/fleetAuth.js';
import { createWorkOrder } from '../services/operationsPersistence.js';
import { workOrderExecutionService } from '../services/workOrderExecution.js';
import { prospectingService } from '../services/prospecting.js';

export const agentActionsRouter = Router();
const consumedProposals = new Set<string>();

agentActionsRouter.post('/propose', (req, res) => {
  try { return res.status(201).json(createAgentActionProposal(req.body?.kind, req.body?.payload)); }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid action proposal' }); }
});

agentActionsRouter.post('/execute', async (req, res) => {
  if (req.body?.confirmed !== true) return res.status(409).json({ error: 'Explicit confirmation is required' });
  let proposalId: string | null = null;
  try {
    const proposal = verifyAgentActionProposal(req.body?.confirmationToken);
    proposalId = proposal.id;
    if (consumedProposals.has(proposal.id)) return res.status(409).json({ error: 'This action was already executed' });
    consumedProposals.add(proposal.id);

    if (proposal.kind === 'email.send') {
      const organizationId = await requireFleetOrganization(req);
      const prospectId = proposal.payload.prospectId ? String(proposal.payload.prospectId) : null;
      if (prospectId) await prospectingService.get(organizationId, prospectId);
      const client = getAgentMailClient() as any;
      if (!client) throw new Error('AgentMail is not configured');
      const mailPayload = { to: proposal.payload.to, subject: proposal.payload.subject, text: proposal.payload.text };
      const result = await client.inboxes.messages.send(serverConfig.defaultInbox, mailPayload);
      if (prospectId) {
        const externalMessageId = String(result?.message_id || result?.messageId || result?.id || '');
        await prospectingService.recordOutreach(organizationId, prospectId, {
          to: proposal.payload.to,
          subject: proposal.payload.subject,
          text: proposal.payload.text,
          contactId: proposal.payload.contactId,
          externalMessageId,
        });
      }
      return res.json({ executed: true, proposalId: proposal.id, kind: proposal.kind, result });
    }

    if (proposal.kind === 'calendar.create') {
      const tokens = readGoogleTokens(req);
      if (!tokens) return res.status(401).json({ error: 'Connect Google before creating calendar events' });
      const result = await googleFetch<any>('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', tokens, {
        method: 'POST', body: JSON.stringify(proposal.payload),
      });
      writeGoogleTokens(res, result.tokens);
      return res.json({ executed: true, proposalId: proposal.id, kind: proposal.kind, result: result.data });
    }

    const organizationId = await requireFleetOrganization(req);
    if (proposal.kind === 'fleet.work_order.create') {
      const result = await createWorkOrder(organizationId, proposal.payload);
      return res.json({ executed: true, proposalId: proposal.id, kind: proposal.kind, result });
    }
    if (proposal.kind === 'fleet.work_order.transition') {
      const result = await workOrderExecutionService.transition(organizationId, String(proposal.payload.workOrderId), String(proposal.payload.status));
      return res.json({ executed: true, proposalId: proposal.id, kind: proposal.kind, result });
    }
    if (proposal.kind === 'fleet.authorization.decision') {
      const decision = String(proposal.payload.decision) as 'authorized' | 'rejected';
      const result = await workOrderExecutionService.decideAuthorization(organizationId, String(proposal.payload.authorizationId), decision, proposal.payload);
      return res.json({ executed: true, proposalId: proposal.id, kind: proposal.kind, result });
    }

    throw new Error('Unsupported agent action');
  } catch (error) {
    if (proposalId) consumedProposals.delete(proposalId);
    if (error instanceof FleetAuthError) return fleetAuthFailure(res, error);
    const message = error instanceof Error ? error.message : 'Agent action failed';
    const invalid = /required|expired|changed|valid|Unsupported|Invalid|must|cannot|not found/i.test(message);
    return res.status(invalid ? 400 : 502).json({ error: message });
  }
});