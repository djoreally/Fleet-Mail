CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','dispatcher','technician','viewer')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  token_hash text NOT NULL,
  invited_by_user_id text REFERENCES public.users(id) ON DELETE SET NULL,
  accepted_by_user_id text REFERENCES public.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','sent','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_invitations_org_idx ON public.organization_invitations(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS organization_invitations_email_idx ON public.organization_invitations(lower(email), status);
CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_pending_email_uq
  ON public.organization_invitations(organization_id, lower(email)) WHERE status = 'pending';

-- Invitation tokens are an application-server capability and must never be exposed through the Data API.
REVOKE ALL ON public.organization_invitations FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE 'REVOKE ALL ON public.organization_invitations FROM authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON public.organization_invitations FROM anon'; END IF;
END $$;
