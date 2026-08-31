-- Align Fleet OS tenant RLS with Neon Data API JWT authentication.
-- auth.user_id() reads the verified JWT `sub` claim selected by the Data API.
CREATE OR REPLACE FUNCTION app.current_auth_subject() RETURNS text
LANGUAGE sql STABLE PARALLEL SAFE
SET search_path = ''
AS $$ SELECT auth.user_id() $$;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- Atomic first-login provisioning. It is intentionally the only path that can
-- create a user's initial organization and owner membership.
CREATE OR REPLACE FUNCTION app.bootstrap_tenant(
  user_email text,
  user_name text,
  organization_name text,
  organization_slug text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  subject text := auth.user_id();
  app_user_id text;
  tenant_id text;
BEGIN
  IF subject IS NULL OR subject = '' THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT u.id INTO app_user_id FROM public.users u WHERE u.auth_subject = subject;
  IF app_user_id IS NULL THEN
    INSERT INTO public.users (id, auth_subject, email, name)
    VALUES (gen_random_uuid()::text, subject, lower(user_email), COALESCE(NULLIF(user_name, ''), split_part(user_email, '@', 1)))
    RETURNING id INTO app_user_id;
  END IF;

  SELECT m.organization_id INTO tenant_id
  FROM public.organization_memberships m
  WHERE m.user_id = app_user_id AND m.status = 'active'
  ORDER BY m.created_at LIMIT 1;

  IF tenant_id IS NULL THEN
    INSERT INTO public.organizations (id, name, slug, status)
    VALUES (gen_random_uuid()::text, COALESCE(NULLIF(organization_name, ''), 'My Fleet'),
      COALESCE(NULLIF(organization_slug, ''), 'fleet-' || substr(md5(subject), 1, 10)), 'active')
    RETURNING id INTO tenant_id;

    INSERT INTO public.organization_memberships (id, organization_id, user_id, role, status)
    VALUES (gen_random_uuid()::text, tenant_id, app_user_id, 'owner', 'active');
  END IF;

  RETURN tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION app.bootstrap_tenant(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.bootstrap_tenant(text, text, text, text) TO authenticated;
