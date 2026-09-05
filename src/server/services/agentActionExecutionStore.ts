import { Pool } from '@neondatabase/serverless';
import type { AgentActionProposal } from './agentActions.js';

export class AgentActionReplayError extends Error {
  status = 409;
}

function databaseUrl() {
  const value = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL or NEON_DATABASE_URL is required');
  return value;
}

function jsonValue(value: unknown) {
  if (value === undefined) return null;
  return JSON.stringify(value);
}

export async function claimAgentActionExecution(organizationId: string, proposal: AgentActionProposal) {
  const pool = new Pool({ connectionString: databaseUrl() });
  try {
    const inserted = await pool.query(
      `INSERT INTO public.agent_action_executions
        (proposal_id, organization_id, kind, status)
       VALUES ($1, $2, $3, 'executing')
       ON CONFLICT (proposal_id) DO NOTHING
       RETURNING proposal_id`,
      [proposal.id, organizationId, proposal.kind],
    );
    if (inserted.rowCount) return;

    const existing = await pool.query(
      `SELECT organization_id, kind, status
       FROM public.agent_action_executions
       WHERE proposal_id = $1
       LIMIT 1`,
      [proposal.id],
    );
    const row = existing.rows[0] as { organization_id?: string; kind?: string; status?: string } | undefined;
    if (!row) throw new AgentActionReplayError('This action proposal could not be claimed');
    if (row.organization_id !== organizationId || row.kind !== proposal.kind) {
      throw new AgentActionReplayError('This action proposal does not belong to this Fleet organization');
    }
    throw new AgentActionReplayError(
      row.status === 'succeeded'
        ? 'This action was already executed'
        : 'This action proposal was already attempted',
    );
  } finally {
    await pool.end();
  }
}

export async function markAgentActionSucceeded(
  organizationId: string,
  proposalId: string,
  result: unknown,
) {
  const pool = new Pool({ connectionString: databaseUrl() });
  try {
    await pool.query(
      `UPDATE public.agent_action_executions
       SET status = 'succeeded', result = $3::jsonb, error = NULL,
           completed_at = now(), updated_at = now()
       WHERE proposal_id = $1 AND organization_id = $2 AND status = 'executing'`,
      [proposalId, organizationId, jsonValue(result)],
    );
  } finally {
    await pool.end();
  }
}

export async function markAgentActionFailed(
  organizationId: string,
  proposalId: string,
  error: unknown,
) {
  const pool = new Pool({ connectionString: databaseUrl() });
  try {
    const message = error instanceof Error ? error.message : String(error || 'Agent action failed');
    await pool.query(
      `UPDATE public.agent_action_executions
       SET status = 'failed', error = $3, completed_at = now(), updated_at = now()
       WHERE proposal_id = $1 AND organization_id = $2 AND status = 'executing'`,
      [proposalId, organizationId, message.slice(0, 4000)],
    );
  } finally {
    await pool.end();
  }
}
