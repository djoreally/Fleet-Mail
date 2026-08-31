import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle as drizzleServerless } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import * as schema from './drizzleSchema';

// Configure WebSocket connection behavior for Neon Serverless if needed in Node.js
if (typeof ws === 'undefined' && typeof process !== 'undefined') {
  try {
    // ws is handled automatically in Neon serverless
  } catch (e) {
    // ignore
  }
}

let dbInstance: ReturnType<typeof drizzleHttp> | ReturnType<typeof drizzleServerless> | null = null;

/**
 * Initializes and returns the typed Drizzle ORM database instance for Neon PostgreSQL.
 * Supports both HTTP queries and WebSocket transactions.
 */
export function getDb(customConnectionString?: string) {
  const connectionString =
    customConnectionString ||
    (typeof process !== 'undefined' ? process.env.DATABASE_URL || process.env.NEON_DATABASE_URL : undefined);

  if (!connectionString) {
    return null;
  }

  if (!dbInstance) {
    // Create HTTP connection for low-latency serverless stateless queries
    const sql = neon(connectionString);
    dbInstance = drizzleHttp(sql, { schema });
  }

  return dbInstance;
}

/**
 * Creates a dedicated Pool connection for transactional / continuous operations
 */
export function createNeonPool(connectionString?: string) {
  const url =
    connectionString ||
    (typeof process !== 'undefined' ? process.env.DATABASE_URL || process.env.NEON_DATABASE_URL : undefined);

  if (!url) {
    throw new Error('DATABASE_URL or NEON_DATABASE_URL environment variable is required to create a Pool connection.');
  }

  const pool = new Pool({ connectionString: url });
  return drizzleServerless(pool, { schema });
}

export * from './drizzleSchema';
export { schema };
