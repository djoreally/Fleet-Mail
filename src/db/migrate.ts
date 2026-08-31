import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Pool } from '@neondatabase/serverless';

export interface MigrationReport {
  success: boolean;
  migrations: string[];
  timestamp: string;
}

/** Applies checked-in forward SQL. Generate base DDL with `npm run db:generate`
 * before applying the RLS migration to a new database. */
export async function runDrizzleMigration(customDatabaseUrl?: string): Promise<MigrationReport> {
  const databaseUrl = customDatabaseUrl || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL or NEON_DATABASE_URL is required');
  const migrationDirectory = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
  const migrations = ['0001_multitenant_rls.sql', '0002_neon_auth_tenant_bootstrap.sql'];
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query('BEGIN');
    for (const name of migrations) {
      await pool.query(await readFile(join(migrationDirectory, name), 'utf8'));
    }
    await pool.query('COMMIT');
    return { success: true, migrations, timestamp: new Date().toISOString() };
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runDrizzleMigration()
    .then(report => console.log(JSON.stringify(report, null, 2)))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
