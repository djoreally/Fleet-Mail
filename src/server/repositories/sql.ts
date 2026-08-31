export interface QueryResult<TRow extends Record<string, unknown> = Record<string, unknown>> {
  rows: TRow[];
  rowCount?: number | null;
}

export interface SqlExecutor {
  query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<TRow>>;
}

export interface TransactionalSqlExecutor extends SqlExecutor {
  transaction<T>(work: (transaction: SqlExecutor) => Promise<T>): Promise<T>;
}

export function requireOrganizationId(organizationId: string): string {
  const normalized = organizationId.trim();
  if (!normalized) throw new Error('organizationId is required');
  return normalized;
}

export function pageValues(limit = 50, offset = 0): [number, number] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('limit must be between 1 and 200');
  if (!Number.isInteger(offset) || offset < 0) throw new Error('offset must be a non-negative integer');
  return [limit, offset];
}
