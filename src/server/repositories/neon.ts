import { Pool } from '@neondatabase/serverless';
import type { QueryResult, SqlExecutor, TransactionalSqlExecutor } from './sql';

type PoolQueryResult = { rows: Record<string, unknown>[]; rowCount?: number | null };

/**
 * Neon WebSocket pool adapter. Use this adapter for writes that need real
 * PostgreSQL transactions; the stateless HTTP driver cannot guarantee them.
 */
export class NeonPoolExecutor implements TransactionalSqlExecutor {
  constructor(private readonly pool: Pool) {}

  static fromConnectionString(connectionString: string): NeonPoolExecutor {
    if (!connectionString.trim()) throw new Error('DATABASE_URL is required');
    return new NeonPoolExecutor(new Pool({ connectionString }));
  }

  async query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<TRow>> {
    const result = await this.pool.query(text, [...values]) as PoolQueryResult;
    return { rows: result.rows as TRow[], rowCount: result.rowCount };
  }

  async transaction<T>(work: (transaction: SqlExecutor) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const transaction: SqlExecutor = {
      query: async <TRow extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) => {
        const result = await client.query(text, [...values]) as PoolQueryResult;
        return { rows: result.rows as TRow[], rowCount: result.rowCount };
      },
    };
    try {
      await client.query('BEGIN');
      const result = await work(transaction);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
