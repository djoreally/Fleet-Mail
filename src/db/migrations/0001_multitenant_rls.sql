-- Forward-only Fleet OS tenant isolation. Run after the Drizzle DDL generated from
-- drizzleSchema.ts. The application sets app.auth_subject for each transaction.
CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_auth_subject() RETURNS text
LANGUAGE sql STABLE PARALLEL SAFE
AS $$ SELECT NULLIF(current_setting('app.auth_subject', true), '') $$;

CREATE OR REPLACE FUNCTION app.is_org_member(target_org text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT target_org IS NOT NULL
    AND app.current_auth_subject() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      JOIN public.users u ON u.id = m.user_id
      WHERE m.organization_id = target_org
        AND m.status = 'active'
        AND u.auth_subject = app.current_auth_subject()
    )
$$;

CREATE OR REPLACE FUNCTION app.is_org_admin(target_org text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT target_org IS NOT NULL
    AND app.current_auth_subject() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      JOIN public.users u ON u.id = m.user_id
      WHERE m.organization_id = target_org
        AND m.status = 'active' AND m.role IN ('owner','admin')
        AND u.auth_subject = app.current_auth_subject()
    )
$$;

REVOKE ALL ON FUNCTION app.current_auth_subject() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.is_org_member(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.is_org_admin(text) FROM PUBLIC;

DO $rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'agentmail_pods','inboxes','agentmail_webhooks','customers','contacts','locations',
    'vehicles','technicians','resources','availability','work_orders','appointments',
    'dispatch_assignments','dispatch_status_history','inspections','authorizations',
    'maintenance_schedules','maintenance_events','parts','inventory','part_usage',
    'estimates','invoices','invoice_line_items','payments','email_threads','emails',
    'email_summaries','documents','audit_events','chat_messages'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_member_access ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_member_access ON public.%I FOR ALL USING (app.is_org_member(organization_id)) WITH CHECK (app.is_org_member(organization_id))',
      table_name
    );
  END LOOP;
END $rls$;

ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS membership_read ON public.organization_memberships;
CREATE POLICY membership_read ON public.organization_memberships FOR SELECT
USING (app.is_org_member(organization_id));
DROP POLICY IF EXISTS membership_admin_write ON public.organization_memberships;
CREATE POLICY membership_admin_write ON public.organization_memberships FOR ALL
USING (app.is_org_admin(organization_id)) WITH CHECK (app.is_org_admin(organization_id));

-- Users may only see or update their own identity row. No anonymous/null path.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_self ON public.users;
CREATE POLICY users_self ON public.users FOR ALL
USING (app.current_auth_subject() IS NOT NULL AND auth_subject = app.current_auth_subject())
WITH CHECK (app.current_auth_subject() IS NOT NULL AND auth_subject = app.current_auth_subject());

-- Organizations are visible to members; organization mutation is admin-only.
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizations_read ON public.organizations;
CREATE POLICY organizations_read ON public.organizations FOR SELECT USING (app.is_org_member(id));
DROP POLICY IF EXISTS organizations_admin_write ON public.organizations;
CREATE POLICY organizations_admin_write ON public.organizations FOR ALL
USING (app.is_org_admin(id)) WITH CHECK (app.is_org_admin(id));
