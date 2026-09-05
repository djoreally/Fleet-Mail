import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Fleet Agent durable execution contract', () => {
  const route = readFileSync('src/server/routes/agentActions.ts', 'utf8');
  const actions = readFileSync('src/server/services/agentActions.ts', 'utf8');
  const store = readFileSync('src/server/services/agentActionExecutionStore.ts', 'utf8');
  const migration = readFileSync('src/db/migrations/0006_agent_action_executions.sql', 'utf8');
  const migrate = readFileSync('src/db/migrate.ts', 'utf8');
  const chat = readFileSync('src/server/routes/chat.ts', 'utf8');
  const prospecting = readFileSync('src/server/routes/prospecting.ts', 'utf8');

  it('binds signed proposals to the authenticated Fleet organization', () => {
    expect(actions).toContain('organizationId?: string');
    expect(actions).toContain('expectedOrganizationId?: string');
    expect(actions).toContain('does not belong to this Fleet organization');
    expect(route).toContain("verifyAgentActionProposal(req.body?.confirmationToken, organizationId)");
    expect(chat).toContain('createAgentActionProposal(action.kind, action.payload, organizationId)');
    expect(prospecting).toContain("createAgentActionProposal('fleet.prospect.convert',{prospectId:req.params.id},org)");
  });

  it('requires agent authority before signing or executing a proposal', () => {
    expect(route.match(/requireFleetPermission\(req, 'agent.execute'\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(route).toContain("requireFleetPermission(req, 'inbox.send')");
    expect(route).toContain("requireFleetPermission(req, 'schedule.manage')");
    expect(route).toContain("requireFleetPermission(req, 'work_orders.manage')");
    expect(route).toContain("requireFleetPermission(req, 'authorizations.manage')");
    expect(route).toContain("requireFleetPermission(req, 'prospects.manage')");
  });

  it('uses a durable Neon claim instead of process-memory replay protection', () => {
    expect(route).not.toContain('new Set<string>()');
    expect(route).toContain('claimAgentActionExecution');
    expect(store).toContain('ON CONFLICT (proposal_id) DO NOTHING');
    expect(store).toContain("row.status === 'succeeded'");
    expect(store).toContain('already attempted');
  });

  it('records every claimed attempt as succeeded or failed without making the same token retryable', () => {
    expect(route).toContain('markAgentActionSucceeded');
    expect(route).toContain('markAgentActionFailed');
    expect(store).toContain("SET status = 'succeeded'");
    expect(store).toContain("SET status = 'failed'");
    expect(store).not.toContain("status = 'failed' RETURNING");
  });

  it('ships the execution ledger as the next canonical migration and keeps it server-only', () => {
    expect(migrate).toContain("'0006_agent_action_executions.sql'");
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.agent_action_executions');
    expect(migration).toContain('organization_id text NOT NULL REFERENCES public.organizations(id)');
    expect(migration).toContain('REVOKE ALL ON public.agent_action_executions FROM PUBLIC');
  });
});
