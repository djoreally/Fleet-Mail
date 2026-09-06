-- Keep internal Fleet control-plane ledgers inaccessible to Data API client roles.
-- These tables are written only by the trusted server/database owner path.
REVOKE ALL PRIVILEGES ON TABLE public.agent_action_executions FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.agent_action_executions FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.agent_action_executions FROM anonymous;

REVOKE ALL PRIVILEGES ON TABLE public.app_schema_migrations FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.app_schema_migrations FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.app_schema_migrations FROM anonymous;

-- Legacy schema-inspection helper must not be callable through Data API roles.
REVOKE ALL PRIVILEGES ON FUNCTION public.show_db_tree() FROM PUBLIC;
REVOKE ALL PRIVILEGES ON FUNCTION public.show_db_tree() FROM authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.show_db_tree() FROM anonymous;
