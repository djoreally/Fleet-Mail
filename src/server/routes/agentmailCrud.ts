import { Router } from 'express';
import { getAgentMailClient } from '../services/agentmail.js';

export const agentmailCrudRouter = Router();

function client() {
  const value = getAgentMailClient();
  if (!value) throw new Error('AgentMail is not configured');
  return value as any;
}

function inbox(res: any) {
  const value = String(res.locals.agentMailInbox || '').trim();
  if (!value) {
    res.status(401).json({ error: 'A verified organization-scoped AgentMail inbox is required' });
    return null;
  }
  return value;
}

function confirmed(req: any, res: any) {
  if (req.headers['x-confirm-action'] === 'true') return true;
  res.status(409).json({ error: 'This write requires explicit confirmation', confirmationHeader: 'x-confirm-action: true' });
  return false;
}

function fail(res: any, error: unknown) {
  const message = error instanceof Error ? error.message : 'AgentMail request failed';
  return res.status(message.includes('configured') ? 503 : 502).json({ error: message });
}

agentmailCrudRouter.get('/messages/search', async (req, res) => {
  const id = inbox(res); if (!id) return;
  try { return res.json(await client().inboxes.messages.search(id, { query: String(req.query.q || ''), limit: Number(req.query.limit) || 30 })); } catch (e) { return fail(res, e); }
});

agentmailCrudRouter.get('/messages/:messageId', async (req, res) => {
  const id = inbox(res); if (!id) return;
  try { return res.json(await client().inboxes.messages.get(id, req.params.messageId)); } catch (e) { return fail(res, e); }
});

agentmailCrudRouter.patch('/messages/:messageId', async (req, res) => {
  const id = inbox(res); if (!id || !confirmed(req, res)) return;
  try { return res.json(await client().inboxes.messages.update(id, req.params.messageId, req.body)); } catch (e) { return fail(res, e); }
});

agentmailCrudRouter.delete('/messages/:messageId', async (req, res) => {
  const id = inbox(res); if (!id || !confirmed(req, res)) return;
  try { await client().inboxes.messages.delete(id, req.params.messageId); return res.status(204).end(); } catch (e) { return fail(res, e); }
});

for (const action of ['reply', 'replyAll', 'forward'] as const) {
  agentmailCrudRouter.post(`/messages/:messageId/${action}`, async (req, res) => {
    const id = inbox(res); if (!id || !confirmed(req, res)) return;
    try { return res.json(await client().inboxes.messages[action](id, req.params.messageId, req.body)); } catch (e) { return fail(res, e); }
  });
}

agentmailCrudRouter.get('/threads/:threadId', async (req, res) => {
  const id = inbox(res); if (!id) return;
  try { return res.json(await client().inboxes.threads.get(id, req.params.threadId)); } catch (e) { return fail(res, e); }
});

agentmailCrudRouter.patch('/threads/:threadId', async (req, res) => {
  const id = inbox(res); if (!id || !confirmed(req, res)) return;
  try { return res.json(await client().inboxes.threads.update(id, req.params.threadId, req.body)); } catch (e) { return fail(res, e); }
});

agentmailCrudRouter.delete('/threads/:threadId', async (req, res) => {
  const id = inbox(res); if (!id || !confirmed(req, res)) return;
  try { await client().inboxes.threads.delete(id, req.params.threadId); return res.status(204).end(); } catch (e) { return fail(res, e); }
});

agentmailCrudRouter.get('/drafts', async (_req, res) => {
  const id = inbox(res); if (!id) return;
  try { return res.json(await client().inboxes.drafts.list(id, { limit: 30 })); } catch (e) { return fail(res, e); }
});

agentmailCrudRouter.post('/drafts', async (req, res) => {
  const id = inbox(res); if (!id || !confirmed(req, res)) return;
  try { return res.status(201).json(await client().inboxes.drafts.create(id, req.body)); } catch (e) { return fail(res, e); }
});

agentmailCrudRouter.get('/drafts/:draftId', async (req, res) => {
  const id = inbox(res); if (!id) return;
  try { return res.json(await client().inboxes.drafts.get(id, req.params.draftId)); } catch (e) { return fail(res, e); }
});

agentmailCrudRouter.patch('/drafts/:draftId', async (req, res) => {
  const id = inbox(res); if (!id || !confirmed(req, res)) return;
  try { return res.json(await client().inboxes.drafts.update(id, req.params.draftId, req.body)); } catch (e) { return fail(res, e); }
});

agentmailCrudRouter.delete('/drafts/:draftId', async (req, res) => {
  const id = inbox(res); if (!id || !confirmed(req, res)) return;
  try { await client().inboxes.drafts.delete(id, req.params.draftId); return res.status(204).end(); } catch (e) { return fail(res, e); }
});

agentmailCrudRouter.post('/drafts/:draftId/send', async (req, res) => {
  const id = inbox(res); if (!id || !confirmed(req, res)) return;
  try { return res.json(await client().inboxes.drafts.send(id, req.params.draftId, req.body || {})); } catch (e) { return fail(res, e); }
});
