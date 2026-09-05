import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('public API security boundaries', () => {
  const compact = (value: string) => value.replace(/\s+/g, '');

  it('requires an authenticated Fleet session for AI, communications, vehicle, contact, and agent surfaces', () => {
    const app = compact(readFileSync('src/server/app.ts', 'utf8'));
    for (const route of ['/api/chat', '/api/rewrite-tone', '/api/generate-draft', '/api/summarize-email', '/api/agentmail', '/api/vehicles', '/api/contacts', '/api/agent']) {
      expect(app).toContain(`app.use('${route}',requireFleetSession)`);
    }
  });

  it('keeps the public status response free of internal service locations and model identifiers', () => {
    const app = readFileSync('src/server/app.ts', 'utf8');
    const statusBlock = app.slice(app.indexOf("app.get('/api/status'"), app.indexOf("app.get('/api/access'"));
    expect(statusBlock).not.toContain('neonDataApiUrl:');
    expect(statusBlock).not.toContain('neonAuthUrl:');
    expect(statusBlock).not.toContain('model:');
  });

  it('does not allow inbox identity to substitute for authenticated organization membership', () => {
    const runtime = readFileSync('src/server/services/fleetAgentRuntime.ts', 'utf8');
    expect(runtime).toContain('requireFleetOrganization(req)');
    expect(runtime).not.toContain('resolveAgentRuntimeOrganization');
  });

  it('scopes AgentMail requests to an active inbox owned by the authenticated organization', () => {
    const app = compact(readFileSync('src/server/app.ts', 'utf8'));
    const boundary = readFileSync('src/server/services/agentMailTenantBoundary.ts', 'utf8');
    const crud = readFileSync('src/server/routes/agentmailCrud.ts', 'utf8');
    expect(app).toContain("app.use('/api/agentmail',enforceAgentMailInboxScope)");
    expect(boundary).toContain('eq(inboxes.organizationId, organizationId)');
    expect(boundary).toContain('eq(inboxes.isActive, true)');
    expect(boundary).toContain('does not belong to this organization');
    expect(crud).toContain('res.locals.agentMailInbox');
    expect(crud).not.toContain('serverConfig.defaultInbox');
  });

  it('uses tenant-scoped inbox grounding for chat rather than the global default inbox', () => {
    const app = compact(readFileSync('src/server/app.ts', 'utf8'));
    const chat = readFileSync('src/server/routes/chat.ts', 'utf8');
    expect(app).toContain("app.use('/api/chat',enforceAgentMailInboxScope)");
    expect(app).toContain("app.use('/api/chat',tenantChatRouter)");
    expect(chat).toContain('res.locals.agentMailInbox');
    expect(chat).not.toContain('DEFAULT_INBOX');
  });

  it('does not expose database query or migration control plane through the application', () => {
    const app = compact(readFileSync('src/server/app.ts', 'utf8'));
    const api = readFileSync('src/server/routes/api.ts', 'utf8');
    expect(app).toContain("app.use('/api/neon',disabledDatabaseControlPlane)");
    expect(app).toContain("app.use('/api/drizzle',disabledDatabaseControlPlane)");
    expect(app.indexOf("app.use('/api/neon',disabledDatabaseControlPlane)")).toBeLessThan(app.indexOf("app.use('/api',apiRouter)"));
    expect(app.indexOf("app.use('/api/drizzle',disabledDatabaseControlPlane)")).toBeLessThan(app.indexOf("app.use('/api',apiRouter)"));
    expect(app).not.toContain('requireFleetAdmin');
    expect(api).toContain("apiRouter.post('/neon/query'");
    expect(api).toContain("apiRouter.post('/neon/migrate'");
    expect(api).toContain("apiRouter.post('/drizzle/migrate'");
  });

  it('exposes authenticated access context for role-aware clients without replacing server authorization', () => {
    const app = compact(readFileSync('src/server/app.ts', 'utf8'));
    const auth = readFileSync('src/server/services/fleetAuth.ts', 'utf8');
    expect(app).toContain("app.get('/api/access',requireFleetSession");
    expect(auth).toContain('permissionsForRole(role)');
  });

  it('sends confirmed AI email only through the authenticated organization inbox', () => {
    const actions = readFileSync('src/server/routes/agentActions.ts', 'utf8');
    expect(actions).toContain('resolveOrganizationAgentMailInbox(req)');
    expect(actions).toContain('client.inboxes.messages.send(inbox, mailPayload)');
    expect(actions).not.toContain('serverConfig.defaultInbox');
  });
});
