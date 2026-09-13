import { Router } from 'express';
import { and, eq, or } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { agentmailWebhooks, inboxes } from '../../db/drizzleSchema.js';
import { getAgentMailClient } from '../services/agentmail.js';
import { fleetAuthFailure, requireFleetOrganization, requireFleetRole } from '../services/fleetAuth.js';

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

function database() {
  const db = getDb();
  if (!db) throw new Error('Database is not configured');
  return db;
}

function webhookUrl() {
  const explicit = process.env.APP_PUBLIC_URL?.trim();
  if (explicit) return `${explicit.replace(/\/$/, '')}/api/webhooks/agentmail`;
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) return `https://${productionHost.replace(/^https?:\/\//, '').replace(/\/$/, '')}/api/webhooks/agentmail`;
  return 'https://fleetmail.vercel.app/api/webhooks/agentmail';
}

function webhookRows(result: any) {
  return Array.isArray(result?.webhooks) ? result.webhooks : Array.isArray(result) ? result : [];
}

function webhookId(value: any) {
  return String(value?.webhookId || value?.webhook_id || value?.id || '').trim();
}


agentmailCrudRouter.get('/webhook-status', async (req, res) => {
  const id = inbox(res); if (!id) return;
  try {
    const organizationId = await requireFleetOrganization(req);
    await requireFleetRole(req, ['owner', 'admin']);
    const targetUrl = webhookUrl();
    const listed = await client().inboxes.webhooks.list(id);
    const hooks = webhookRows(listed);
    const active = hooks.find((hook: any) => String(hook?.url || '') === targetUrl && hook?.enabled !== false);
    const [localInbox] = await database().select().from(inboxes).where(and(eq(inboxes.organizationId, organizationId), or(eq(inboxes.externalInboxId, id), eq(inboxes.email, id)))).limit(1);
    if (!localInbox) return res.status(404).json({ error: 'Organization AgentMail inbox record was not found' });
    const localRows = await database().select().from(agentmailWebhooks).where(and(eq(agentmailWebhooks.organizationId, organizationId), eq(agentmailWebhooks.inboxId, localInbox.id))).limit(20);
    return res.json({ ready: Boolean(active), inbox: id, targetUrl, webhookId: active ? webhookId(active) : null, persisted: Boolean(active && localRows.some(row => row.externalWebhookId === webhookId(active))) });
  } catch (error) {
    return fleetAuthFailure(res, error);
  }
});

agentmailCrudRouter.post('/webhook-ensure', async (req, res) => {
  const id = inbox(res); if (!id || !confirmed(req, res)) return;
  try {
    const organizationId = await requireFleetOrganization(req);
    await requireFleetRole(req, ['owner', 'admin']);
    const secret = process.env.AGENTMAIL_WEBHOOK_SECRET?.trim();
    if (!secret) return res.status(503).json({ error: 'AGENTMAIL_WEBHOOK_SECRET is not configured' });
    const targetUrl = webhookUrl();
    const listed = await client().inboxes.webhooks.list(id);
    const hooks = webhookRows(listed);
    let hook = hooks.find((candidate: any) => String(candidate?.url || '') === targetUrl && candidate?.enabled !== false);
    let created = false;
    if (!hook) {
      hook = await client().inboxes.webhooks.create(id, {
        url: targetUrl,
        eventTypes: ['message.received'],
        headers: { 'x-fleetmail-webhook-token': secret },
      });
      created = true;
    }
    const externalWebhookId = webhookId(hook);
    if (!externalWebhookId) throw new Error('AgentMail did not return a webhook id');
    const [localInbox] = await database().select().from(inboxes).where(and(eq(inboxes.organizationId, organizationId), or(eq(inboxes.externalInboxId, id), eq(inboxes.email, id)))).limit(1);
    if (!localInbox) return res.status(404).json({ error: 'Organization AgentMail inbox record was not found' });
    const [existing] = await database().select().from(agentmailWebhooks).where(and(eq(agentmailWebhooks.organizationId, organizationId), eq(agentmailWebhooks.externalWebhookId, externalWebhookId))).limit(1);
    if (!existing) await database().insert(agentmailWebhooks).values({
      organizationId,
      podId: localInbox.podId || null,
      inboxId: localInbox.id,
      externalWebhookId,
      signingSecretRef: 'env:AGENTMAIL_WEBHOOK_SECRET',
      eventTypes: ['message.received'],
      status: 'active',
    });
    return res.json({ ready: true, created, inbox: id, targetUrl, webhookId: externalWebhookId });
  } catch (error) {
    return fleetAuthFailure(res, error);
  }
});

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
