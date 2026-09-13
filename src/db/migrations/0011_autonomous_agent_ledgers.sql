-- Autonomous B2B capability donor: durable AgentMail event + agent run ledgers.
CREATE TABLE IF NOT EXISTS public.agent_inbox_events (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_event_id text NOT NULL,
  event_type text NOT NULL,
  inbox_id text REFERENCES public.inboxes(id) ON DELETE SET NULL,
  external_inbox_id text,
  thread_id text,
  external_message_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS agent_inbox_events_org_event_uq
  ON public.agent_inbox_events(organization_id, external_event_id);
CREATE INDEX IF NOT EXISTS agent_inbox_events_org_received_idx
  ON public.agent_inbox_events(organization_id, received_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  inbox_event_id text REFERENCES public.agent_inbox_events(id) ON DELETE SET NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  thread_id text,
  entity_type text,
  entity_id text,
  model text,
  prompt_version text,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_runs_status_check CHECK (status IN ('queued','running','succeeded','failed','blocked'))
);
CREATE INDEX IF NOT EXISTS agent_runs_org_started_idx
  ON public.agent_runs(organization_id, started_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_org_entity_idx
  ON public.agent_runs(organization_id, entity_type, entity_id);

DO $rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['agent_inbox_events','agent_runs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_member_access ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_member_access ON public.%I FOR ALL USING (app.is_org_member(organization_id)) WITH CHECK (app.is_org_member(organization_id))',
      table_name
    );
  END LOOP;
END $rls$;

DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_inbox_events, public.agent_runs TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.agent_inbox_events, public.agent_runs FROM anon;
  END IF;
END $roles$;
