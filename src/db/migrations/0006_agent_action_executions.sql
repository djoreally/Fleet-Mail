-- Durable, tenant-scoped execution ledger for consequential Fleet Agent actions.
-- Internal server table: no client role receives direct access.
CREATE TABLE IF NOT EXISTS public.agent_action_executions (
  proposal_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'executing',
  result jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_action_executions_status_check CHECK (status IN ('executing','succeeded','failed'))
);

CREATE INDEX IF NOT EXISTS agent_action_executions_org_started_idx
  ON public.agent_action_executions(organization_id, started_at DESC);

REVOKE ALL ON public.agent_action_executions FROM PUBLIC;
