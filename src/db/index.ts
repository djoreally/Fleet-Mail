import { neon, Pool } from '@neondatabase/serverless';
import { drizzle as drizzleServerless } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import * as coreSchema from './drizzleSchema.js';
import * as prospectSchema from './prospectSchema.js';

export const schema = { ...coreSchema, ...prospectSchema };
let dbInstance: ReturnType<typeof drizzleHttp> | ReturnType<typeof drizzleServerless> | null = null;

/** Initializes the typed Drizzle instance for the complete Fleet OS schema. */
export function getDb(customConnectionString?: string) {
  const connectionString = customConnectionString || (typeof process !== 'undefined' ? process.env.DATABASE_URL || process.env.NEON_DATABASE_URL : undefined);
  if (!connectionString) return null;
  if (!dbInstance) {
    const sql = neon(connectionString);
    dbInstance = drizzleHttp(sql, { schema });
  }
  return dbInstance;
}

/** Creates a dedicated Pool connection for transactional / continuous operations. */
export function createNeonPool(connectionString?: string) {
  const url = connectionString || (typeof process !== 'undefined' ? process.env.DATABASE_URL || process.env.NEON_DATABASE_URL : undefined);
  if (!url) throw new Error('DATABASE_URL or NEON_DATABASE_URL environment variable is required to create a Pool connection.');
  const pool = new Pool({ connectionString: url });
  return drizzleServerless(pool, { schema });
}

export * from './drizzleSchema.js';
export * from './prospectSchema.js';
