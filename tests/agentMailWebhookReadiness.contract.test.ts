import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('AgentMail legacy inbox webhook readiness', () => {
  const routes=readFileSync('src/server/routes/agentmailCrud.ts','utf8');
  const app=readFileSync('src/server/app.ts','utf8');
  const webhook=readFileSync('src/server/services/prospectWebhook.ts','utf8');

  it('keeps webhook status and repair owner/admin only',()=>{
    expect(routes).toContain("get('/webhook-status'");
    expect(routes).toContain("post('/webhook-ensure'");
    expect(routes).toContain("requireFleetRole(req, ['owner', 'admin'])");
    expect(routes).toContain("x-confirm-action: true");
  });

  it('uses inbox-scoped list-before-create behavior without creating pods or inboxes',()=>{
    expect(routes).toContain('client().inboxes.webhooks.list(id)');
    expect(routes).toContain('client().inboxes.webhooks.create(id');
    expect(routes).not.toContain('pods.create');
    expect(routes).not.toContain('inboxes.create');
    expect(routes).toContain("eventTypes: ['message.received']");
  });

  it('uses a write-only bridge token and never returns the configured secret',()=>{
    expect(routes).toContain("'x-fleetmail-webhook-token': secret");
    expect(routes).toContain("signingSecretRef: 'env:AGENTMAIL_WEBHOOK_SECRET'");
    expect(routes).not.toContain('res.json({ secret');
    expect(routes).not.toContain('res.json({secret');
    expect(webhook).toContain('verifyAgentMailWebhookToken');
    expect(app).toContain('verifyAgentMailWebhookToken');
  });

  it('persists webhook metadata only after AgentMail returns an id',()=>{
    expect(routes).toContain("if (!externalWebhookId) throw new Error('AgentMail did not return a webhook id')");
    expect(routes).toContain('agentmailWebhooks');
    expect(routes).toContain('externalWebhookId');
  });
});
