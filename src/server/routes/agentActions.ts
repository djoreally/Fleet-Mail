import { Router } from 'express';
import { getAgentMailClient } from '../services/agentmail.js';
import { createAgentActionProposal, verifyAgentActionProposal } from '../services/agentActions.js';
import { AgentActionReplayError, claimAgentActionExecution, markAgentActionFailed, markAgentActionSucceeded } from '../services/agentActionExecutionStore.js';
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

agentActionsRouter.post('/propose', async (req, res) => {
  try {
    await requireFleetPermission(req, 'agent.execute');
    const organizationId = await requireFleetOrganization(req);
    return res.status(201).json(createAgentActionProposal(req.body?.kind, req.body?.payload, organizationId));
  } catch (error) {
    if (error instanceof FleetAuthError) return fleetAuthFailure(res, error);
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid action proposal' });
  }
});

agentActionsRouter.post('/execute', async (req, res) => {
  if (req.body?.confirmed !== true) return res.status(409).json({ error: 'Explicit confirmation is required' });
  let proposalId: string | null = null;
  let organizationId: string | null = null;
  let claimed = false;
  try {
    await requireFleetPermission(req, 'agent.execute');
    organizationId = await requireFleetOrganization(req);
    const proposal = verifyAgentActionProposal(req.body?.confirmationToken, organizationId);
    proposalId = proposal.id;
    await claimAgentActionExecution(organizationId, proposal);
    claimed = true;

    const finish = async (result: unknown) => {
      await markAgentActionSucceeded(organizationId!, proposal.id, result);
      return res.json({ executed: true, proposalId: proposal.id, kind: proposal.kind, result });
    };

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
      return finish(result);
    }

    if (proposal.kind === 'calendar.create') {
      await requireFleetPermission(req, 'schedule.manage');
      const tokens = readGoogleTokens(req);
      if (!tokens) throw new Error('Connect Google before creating calendar events');
      const result = await googleFetch<any>('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', tokens, { method: 'POST', body: JSON.stringify(proposal.payload) });
      writeGoogleTokens(res, result.tokens);
      return finish(result.data);
    }

    if (proposal.kind === 'fleet.work_order.create') {
      await requireFleetPermission(req, 'work_orders.manage');
      return finish(await createWorkOrder(organizationId, proposal.payload));
    }
    if (proposal.kind === 'fleet.work_order.transition') {
      await requireFleetPermission(req, 'work_orders.manage');
      const status = String(proposal.payload.status);
      const result = ['complete', 'completed'].includes(status)
        ? await workOrderCompletionService.complete(organizationId, String(proposal.payload.workOrderId))
        : await workOrderExecutionService.transition(organizationId, String(proposal.payload.workOrderId), status);
      return finish(result);
    }
    if (proposal.kind === 'fleet.authorization.decision') {
      await requireFleetPermission(req, 'authorizations.manage');
      const decision = String(proposal.payload.decision) as 'authorized' | 'rejected';
      return finish(await workOrderExecutionService.decideAuthorization(organizationId, String(proposal.payload.authorizationId), decision, proposal.payload));
    }
    if (proposal.kind === 'fleet.prospect.convert') {
      await requireFleetPermission(req, 'prospects.manage');
      return finish(await prospectingService.convertToFleetAccount(organizationId, String(proposal.payload.prospectId)));
    }
    throw new Error('Unsupported agent action');
  } catch (error) {
    if (claimed && proposalId && organizationId) {
      await markAgentActionFailed(organizationId, proposalId, error).catch((markError) => {
        console.error('Failed to persist agent action failure:', markError instanceof Error ? markError.message : markError);
      });
    }
    if (error instanceof FleetAuthError) return fleetAuthFailure(res, error);
    if (error instanceof AgentActionReplayError) return res.status(error.status).json({ error: error.message });
    const message = error instanceof Error ? error.message : 'Agent action failed';
    const invalid = /required|expired|changed|valid|Unsupported|Invalid|must|cannot|not found|does not belong/i.test(message);
    return res.status(invalid ? 400 : 502).json({ error: message });
  }
});
