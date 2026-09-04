import { Router } from 'express';
import { getAgentMailClient } from '../services/agentmail.js';
import { createAgentActionProposal, verifyAgentActionProposal } from '../services/agentActions.js';
import { googleFetch } from '../services/googleOAuth.js';
import { readGoogleTokens, writeGoogleTokens } from './google.js';
import { FleetAuthError, fleetAuthFailure, requireFleetOrganization, requireFleetPermission } from '../services/fleetAuth.js';
import { resolveOrganizationAgentMailInbox } from '../services/agentMailTenantBoundary.js';
import { createWorkOrder } from '../services/operationsPersistence.js';
import { workOrderExecutionService } from '../services/workOrderExecution.js';
import { workOrderCompletionService } from '../services/workOrderCompletion.js';
import { prospectingService } from '../services/prospecting.js';
import { prospectOutreachService } from '../services/prospectOutreach.js';

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
    await requireFleetPermission(req, 'agent.execute');
    const proposal = verifyAgentActionProposal(req.body?.confirmationToken);
    proposalId = proposal.id;
    if (consumedProposals.has(proposal.id)) return res.status(409).json({ error: 'This action was already executed' });
    consumedProposals.add(proposal.id);

    const organizationId = await requireFleetOrganization(req);

    if (proposal.kind === 'email.send') {
      await requireFleetPermission(req, 'inbox.send');
      const prospectId = proposal.payload.prospectId ? String(proposal.payload.prospectId) : null;
      if (prospectId) await prospectingService.get(organizationId, prospectId);
      const client = getAgentMailClient() as any;
      if (!client) throw new Error('AgentMail is not configured');
      const inbox = await resolveOrganizationAgentMailInbox(req);
      const mailPayload = { to: proposal.payload.to, subject: proposal.payload.subject, text: proposal.payload.text };
      const result = await client.inboxes.messages.send(inbox, mailPayload);
      if (prospectId) {
        const externalMessageId = String(result?.message_id || result?.messageId || result?.id || '');
        await prospectOutreachService.recordSent(organizationId, prospectId, {
          to: proposal.payload.to, subject: proposal.payload.subject, text: proposal.payload.text,
          contactId: proposal.payload.contactId, externalMessageId,
        });
      }
      return res.json({ executed: true, proposalId: proposal.id, kind: proposal.kind, result });
    }

    if (proposal.kind === 'calendar.create') {
      await requireFleetPermission(req, 'schedule.manage');
      const tokens = readGoogleTokens(req);
      if (!tokens) return res.status(401).json({ error: 'Connect Google before creating calendar events' });
      const result = await googleFetch<any>('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', tokens, { method: 'POST', body: JSON.stringify(proposal.payload) });
      writeGoogleTokens(res, result.tokens);
      return res.json({ executed: true, proposalId: proposal.id, kind: proposal.kind, result: result.data });
    }

    if (proposal.kind === 'fleet.work_order.create') {
      await requireFleetPermission(req, 'work_orders.manage');
      const result = await createWorkOrder(organizationId, proposal.payload);
      return res.json({ executed: true, proposalId: proposal.id, kind: proposal.kind, result });
    }
    if (proposal.kind === 'fleet.work_order.transition') {
      await requireFleetPermission(req, 'work_orders.manage');
      const status = String(proposal.payload.status);
      const result = ['complete', 'completed'].includes(status)
        ? await workOrderCompletionService.complete(organizationId, String(proposal.payload.workOrderId))
        : await workOrderExecutionService.transition(organizationId, String(proposal.payload.workOrderId), status);
      return res.json({ executed: true, proposalId: proposal.id, kind: proposal.kind, result });
    }
    if (proposal.kind === 'fleet.authorization.decision') {
      await requireFleetPermission(req, 'authorizations.manage');
      const decision = String(proposal.payload.decision) as 'authorized' | 'rejected';
      const result = await workOrderExecutionService.decideAuthorization(organizationId, String(proposal.payload.authorizationId), decision, proposal.payload);
      return res.json({ executed: true, proposalId: proposal.id, kind: proposal.kind, result });
    }
    if (proposal.kind === 'fleet.prospect.convert') {
      await requireFleetPermission(req, 'prospects.manage');
      const result = await prospectingService.convertToFleetAccount(organizationId, String(proposal.payload.prospectId));
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
