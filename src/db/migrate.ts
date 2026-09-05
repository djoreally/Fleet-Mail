import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Pool } from '@neondatabase/serverless';

export interface MigrationReport { success: boolean; migrations: string[]; skipped: string[]; timestamp: string }

const MIGRATIONS = [
  '0001_multitenant_rls.sql',
  '0002_neon_auth_tenant_bootstrap.sql',
  '0003_operational_chain.sql',
  '0004_prospecting_foundation.sql',
  '0005_team_invitations.sql',
  '0006_agent_action_executions.sql',
] as const;

export async function runDrizzleMigration(customDatabaseUrl?: string, options: { allowRuntime?: boolean } = {}): Promise<MigrationReport> {
  if (process.env.VERCEL && options.allowRuntime !== true) throw new Error('Runtime database migrations are disabled on Vercel');
  const databaseUrl = customDatabaseUrl || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL or NEON_DATABASE_URL is required');
  const migrationDirectory = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
  const pool = new Pool({ connectionString: databaseUrl });
  const applied: string[] = []; const skipped: string[] = [];
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS public.app_schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    for (const name of MIGRATIONS) {
      const existing = await pool.query('SELECT 1 FROM public.app_schema_migrations WHERE name = $1 LIMIT 1', [name]);
      if (existing.rowCount) { skipped.push(name); continue; }
      await pool.query('BEGIN');
      try {
        await pool.query(await readFile(join(migrationDirectory, name), 'utf8'));
        await pool.query('INSERT INTO public.app_schema_migrations(name) VALUES ($1)', [name]);
        await pool.query('COMMIT'); applied.push(name);
      } catch (error) { await pool.query('ROLLBACK'); throw error; }
    }
    return { success: true, migrations: applied, skipped, timestamp: new Date().toISOString() };
  } finally { await pool.end(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runDrizzleMigration(undefined, { allowRuntime: true }).then(report => console.log(JSON.stringify(report, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
}
