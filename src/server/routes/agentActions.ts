import { Router } from 'express';
import { serverConfig } from '../config.js';
import { getAgentMailClient } from '../services/agentmail.js';
import { createAgentActionProposal, verifyAgentActionProposal } from '../services/agentActions.js';
import { googleFetch } from '../services/googleOAuth.js';
import { readGoogleTokens, writeGoogleTokens } from './google.js';

export const agentActionsRouter = Router();
const consumedProposals = new Set<string>();

agentActionsRouter.post('/propose', (req, res) => {
  try {
    return res.status(201).json(createAgentActionProposal(req.body?.kind, req.body?.payload));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid action proposal' });
  }
});

agentActionsRouter.post('/execute', async (req, res) => {
  if (req.body?.confirmed !== true) return res.status(409).json({ error: 'Explicit confirmation is required' });
  try {
    const proposal = verifyAgentActionProposal(req.body?.confirmationToken);
    if (consumedProposals.has(proposal.id)) return res.status(409).json({ error: 'This action was already executed' });
    consumedProposals.add(proposal.id);
    if (proposal.kind === 'email.send') {
      const client = getAgentMailClient() as any;
      if (!client) { consumedProposals.delete(proposal.id); return res.status(503).json({ error: 'AgentMail is not configured' }); }
      const result = await client.inboxes.messages.send(serverConfig.defaultInbox, proposal.payload);
      return res.json({ executed: true, proposalId: proposal.id, kind: proposal.kind, result });
    }

    const tokens = readGoogleTokens(req);
    if (!tokens) { consumedProposals.delete(proposal.id); return res.status(401).json({ error: 'Connect Google before creating calendar events' }); }
    const result = await googleFetch<any>('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', tokens, {
      method: 'POST', body: JSON.stringify(proposal.payload),
    });
    writeGoogleTokens(res, result.tokens);
    return res.json({ executed: true, proposalId: proposal.id, kind: proposal.kind, result: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent action failed';
    const invalid = /required|expired|changed|valid|Unsupported/.test(message);
    return res.status(invalid ? 400 : 502).json({ error: message });
  }
});
