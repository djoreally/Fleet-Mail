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
  const migration = join(dirname(fileURLToPath(import.meta.url)), 'migrations', '0001_multitenant_rls.sql');
  const source = await readFile(migration, 'utf8');
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query('BEGIN');
    await pool.query(source);
    await pool.query('COMMIT');
    return { success: true, migrations: ['0001_multitenant_rls.sql'], timestamp: new Date().toISOString() };
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
