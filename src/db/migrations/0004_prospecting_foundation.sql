-- FleetMail AI revenue engine foundation. Forward-only and idempotent.
CREATE TABLE IF NOT EXISTS public.prospects (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  website text,
  industry text,
  phone text,
  general_email text,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  service_area text,
  estimated_fleet_size integer,
  vehicle_types text[] NOT NULL DEFAULT '{}'::text[],
  source text NOT NULL DEFAULT 'manual',
  source_url text,
  stage text NOT NULL DEFAULT 'new',
  qualification_score integer NOT NULL DEFAULT 0,
  owner_user_id text REFERENCES public.users(id) ON DELETE SET NULL,
  research_summary text,
  fleet_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  research_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_researched_at timestamptz,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  opportunity_value numeric(12,2),
  probability integer NOT NULL DEFAULT 0,
  lost_reason text,
  converted_customer_id text REFERENCES public.customers(id) ON DELETE SET NULL,
  converted_at timestamptz,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prospects_stage_check CHECK (stage IN ('new','researching','qualified','outreach','engaged','meeting','proposal','won','lost','converted')),
  CONSTRAINT prospects_score_check CHECK (qualification_score BETWEEN 0 AND 100),
  CONSTRAINT prospects_probability_check CHECK (probability BETWEEN 0 AND 100),
  CONSTRAINT prospects_fleet_size_check CHECK (estimated_fleet_size IS NULL OR estimated_fleet_size >= 0)
);
CREATE INDEX IF NOT EXISTS prospects_org_stage_idx ON public.prospects(organization_id, stage);
CREATE INDEX IF NOT EXISTS prospects_org_score_idx ON public.prospects(organization_id, qualification_score);
CREATE INDEX IF NOT EXISTS prospects_org_follow_up_idx ON public.prospects(organization_id, next_follow_up_at);
CREATE UNIQUE INDEX IF NOT EXISTS prospects_org_website_uq ON public.prospects(organization_id, website) WHERE website IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.prospect_contacts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prospect_id text NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  title text,
  is_decision_maker boolean NOT NULL DEFAULT false,
  source_url text,
  confidence integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prospect_contacts_confidence_check CHECK (confidence BETWEEN 0 AND 100)
);
CREATE INDEX IF NOT EXISTS prospect_contacts_org_prospect_idx ON public.prospect_contacts(organization_id, prospect_id);
CREATE INDEX IF NOT EXISTS prospect_contacts_org_email_idx ON public.prospect_contacts(organization_id, email);

CREATE TABLE IF NOT EXISTS public.prospect_activities (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prospect_id text NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  kind text NOT NULL,
  direction text,
  channel text,
  subject text,
  summary text,
  external_message_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prospect_activities_org_prospect_idx ON public.prospect_activities(organization_id, prospect_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS prospect_activities_external_message_idx ON public.prospect_activities(organization_id, external_message_id);

DO $rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['prospects','prospect_contacts','prospect_activities'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_member_access ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_member_access ON public.%I FOR ALL USING (app.is_org_member(organization_id)) WITH CHECK (app.is_org_member(organization_id))',
      table_name
    );
  END LOOP;
END $rls$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospects, public.prospect_contacts, public.prospect_activities TO authenticated;
REVOKE ALL ON public.prospects, public.prospect_contacts, public.prospect_activities FROM anon;
