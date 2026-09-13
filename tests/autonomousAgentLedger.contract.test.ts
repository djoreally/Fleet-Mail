import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Autonomous agent ledger contract', () => {
  const migration=readFileSync('src/db/migrations/0011_autonomous_agent_ledgers.sql','utf8');
  const schema=readFileSync('src/db/drizzleSchema.ts','utf8');
  const webhook=readFileSync('src/server/services/prospectWebhook.ts','utf8');
  const route=readFileSync('src/server/routes/agentObservability.ts','utf8');
  const app=readFileSync('src/server/app.ts','utf8');

  it('creates tenant-scoped inbox event and agent run ledgers',()=>{
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.agent_inbox_events');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.agent_runs');
    expect(migration).toContain('app.is_org_member(organization_id)');
    expect(schema).toContain("pgTable('agent_inbox_events'");
    expect(schema).toContain("pgTable('agent_runs'");
  });

  it('records AgentMail webhook intake and run completion/failure',()=>{
    expect(webhook).toContain('db.insert(agentInboxEvents)');
    expect(webhook).toContain("kind:'agentmail_prospect_intake'");
    expect(webhook).toContain("status:'succeeded'");
    expect(webhook).toContain("status:'failed'");
    expect(webhook).toContain('agentRunId');
  });

  it('keeps agent observability tenant-scoped and owner/admin only',()=>{
    expect(route).toContain("requireFleetRole(req,['owner','admin'])");
    expect(route).toContain("eq(agentRuns.organizationId,organizationId)");
    expect(route).toContain("eq(agentInboxEvents.organizationId,organizationId)");
    expect(app).toContain("app.use('/api/agent',agentObservabilityRouter)");
  });

  it('surfaces prospect replies and follow-up attention in the selling workspace',()=>{
    const ui=readFileSync('src/components/operations/ProspectCommandCenter.tsx','utf8');
    expect(ui).toContain('/api/operations/prospects-attention');
    expect(ui).toContain('Needs attention');
    expect(ui).toContain('repliesWaiting');
    expect(ui).toContain('overdue');
    expect(ui).toContain('Draft');
  });
});
