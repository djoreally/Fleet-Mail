import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('internal database control-plane grants',()=>{
  it('keeps the migration ledger inaccessible to Data API client roles on every migration run',()=>{
    const source=readFileSync('src/db/migrate.ts','utf8');
    expect(source).toContain("'0007_internal_control_plane_grants.sql'");
    expect(source).toContain('REVOKE ALL PRIVILEGES ON TABLE public.app_schema_migrations FROM PUBLIC, authenticated, anonymous');
  });

  it('revokes client access from internal control-plane tables',()=>{
    const migration=readFileSync('src/db/migrations/0007_internal_control_plane_grants.sql','utf8');
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE public.agent_action_executions FROM authenticated');
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE public.agent_action_executions FROM anonymous');
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE public.app_schema_migrations FROM authenticated');
  });

  it('blocks Data API roles from the legacy database-tree helper',()=>{
    const migration=readFileSync('src/db/migrations/0007_internal_control_plane_grants.sql','utf8');
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON FUNCTION public.show_db_tree() FROM PUBLIC');
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON FUNCTION public.show_db_tree() FROM authenticated');
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON FUNCTION public.show_db_tree() FROM anonymous');
  });
});
