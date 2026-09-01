import { randomUUID } from 'node:crypto';
import type {
  ContactRecord, ContactRepository, ContactWrite, CustomerRecord, CustomerRepository, CustomerWrite, EmailRecord, EmailRepository, EmailWrite,
  FleetRepositories, OrganizationId, PageRequest, SummaryRecord, SummaryRepository, SummaryWrite,
  ThreadRecord, ThreadRepository, ThreadWrite, VehicleRecord, VehicleRepository, VehicleWrite,
  WorkOrderRecord, WorkOrderRepository, WorkOrderWrite,
} from './contracts.js';
import { pageValues, requireOrganizationId, type SqlExecutor, type TransactionalSqlExecutor } from './sql.js';

type Row = Record<string, unknown>;

const camel = (name: string) => name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
const mapRow = <T>(row: Row): T => Object.fromEntries(Object.entries(row).map(([key, value]) => [camel(key), value])) as T;

abstract class PostgresCrud<TRecord extends { id: string }, TWrite extends { id?: string }> {
  protected constructor(
    protected readonly sql: SqlExecutor,
    private readonly table: string,
    private readonly columns: readonly string[],
    private readonly conflictColumns: readonly string[] = ['id'],
  ) {}

  async getById(organizationId: OrganizationId, id: string): Promise<TRecord | null> {
    const org = requireOrganizationId(organizationId);
    const result = await this.sql.query(`SELECT * FROM ${this.table} WHERE organization_id = $1 AND id = $2 LIMIT 1`, [org, id]);
    return result.rows[0] ? mapRow<TRecord>(result.rows[0]) : null;
  }

  async list(organizationId: OrganizationId, page: PageRequest = {}): Promise<TRecord[]> {
    const org = requireOrganizationId(organizationId);
    const [limit, offset] = pageValues(page.limit, page.offset);
    const result = await this.sql.query(`SELECT * FROM ${this.table} WHERE organization_id = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3`, [org, limit, offset]);
    return result.rows.map((row) => mapRow<TRecord>(row));
  }

  async upsert(organizationId: OrganizationId, value: TWrite): Promise<TRecord> {
    const org = requireOrganizationId(organizationId);
    const input = value as Record<string, unknown>;
    const id = typeof input.id === 'string' && input.id ? input.id : randomUUID();
    const dbColumns = ['id', 'organization_id', ...this.columns];
    const values = [id, org, ...this.columns.map((column) => input[camel(column)] ?? null)];
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    const conflict = ['organization_id', ...this.conflictColumns].join(', ');
    const updates = this.columns.map((column) => `${column} = EXCLUDED.${column}`).concat('updated_at = NOW()').join(', ');
    const result = await this.sql.query(
      `INSERT INTO ${this.table} (${dbColumns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${conflict}) DO UPDATE SET ${updates} RETURNING *`,
      values,
    );
    return mapRow<TRecord>(result.rows[0]);
  }

  async delete(organizationId: OrganizationId, id: string): Promise<boolean> {
    const org = requireOrganizationId(organizationId);
    const result = await this.sql.query(`DELETE FROM ${this.table} WHERE organization_id = $1 AND id = $2`, [org, id]);
    return (result.rowCount ?? 0) > 0;
  }

  protected async findOne(organizationId: string, clause: string, value: unknown): Promise<TRecord | null> {
    const org = requireOrganizationId(organizationId);
    const result = await this.sql.query(`SELECT * FROM ${this.table} WHERE organization_id = $1 AND ${clause} = $2 LIMIT 1`, [org, value]);
    return result.rows[0] ? mapRow<TRecord>(result.rows[0]) : null;
  }

  protected async findMany(organizationId: string, clause: string, value: unknown, page: PageRequest = {}): Promise<TRecord[]> {
    const org = requireOrganizationId(organizationId);
    const [limit, offset] = pageValues(page.limit, page.offset);
    const result = await this.sql.query(`SELECT * FROM ${this.table} WHERE organization_id = $1 AND ${clause} = $2 ORDER BY updated_at DESC LIMIT $3 OFFSET $4`, [org, value, limit, offset]);
    return result.rows.map((row) => mapRow<TRecord>(row));
  }
}

class PgEmails extends PostgresCrud<EmailRecord, EmailWrite> implements EmailRepository {
  constructor(sql: SqlExecutor) { super(sql, 'emails', ['external_id','inbox_id','thread_id','from_address','from_name','to_addresses','subject','text_content','html_content','is_read','is_starred','labels','received_at'], ['external_id']); }
  getByExternalId(org: string, id: string) { return this.findOne(org, 'external_id', id); }
  listByThread(org: string, id: string, page?: PageRequest) { return this.findMany(org, 'thread_id', id, page); }
}
class PgThreads extends PostgresCrud<ThreadRecord, ThreadWrite> implements ThreadRepository {
  constructor(sql: SqlExecutor) { super(sql, 'email_threads', ['external_id','inbox_id','subject','participant_addresses','last_message_at','message_count'], ['external_id']); }
  getByExternalId(org: string, id: string) { return this.findOne(org, 'external_id', id); }
}
class PgSummaries extends PostgresCrud<SummaryRecord, SummaryWrite> implements SummaryRepository {
  constructor(sql: SqlExecutor) { super(sql, 'email_summaries', ['email_id','thread_id','tldr','action_items','urgency','sentiment','suggested_replies','key_points','model_used']); }
  getForEmail(org: string, id: string) { return this.findOne(org, 'email_id', id); }
  getForThread(org: string, id: string) { return this.findOne(org, 'thread_id', id); }
}
class PgContacts extends PostgresCrud<ContactRecord, ContactWrite> implements ContactRepository {
  constructor(sql: SqlExecutor) { super(sql, 'contacts', ['name','email','company','role','phone','notes','tags','is_favorite','source'], ['email']); }
  getByEmail(org: string, email: string) { return this.findOne(org, 'email', email.toLowerCase()); }
}
class PgCustomers extends PostgresCrud<CustomerRecord, CustomerWrite> implements CustomerRepository {
  constructor(sql: SqlExecutor) { super(sql, 'customers', ['name','billing_email','phone','billing_address','notes','status']); }
}
class PgVehicles extends PostgresCrud<VehicleRecord, VehicleWrite> implements VehicleRepository {
  constructor(sql: SqlExecutor) { super(sql, 'vehicles', ['customer_id','unit_number','vin','year','make','model','mileage','status']); }
}
class PgWorkOrders extends PostgresCrud<WorkOrderRecord, WorkOrderWrite> implements WorkOrderRepository {
  constructor(sql: SqlExecutor) { super(sql, 'work_orders', ['vehicle_id','customer_id','source_email_id','number','status','description','scheduled_at','completed_at'], ['number']); }
  listByVehicle(org: string, id: string, page?: PageRequest) { return this.findMany(org, 'vehicle_id', id, page); }
}

export function createPostgresRepositories(sql: SqlExecutor): FleetRepositories {
  return {
    emails: new PgEmails(sql), threads: new PgThreads(sql), summaries: new PgSummaries(sql),
    contacts: new PgContacts(sql), customers: new PgCustomers(sql), vehicles: new PgVehicles(sql), workOrders: new PgWorkOrders(sql),
  };
}

/** Atomically persists a thread, its messages, and optional summaries. */
export async function persistEmailSync(
  sql: TransactionalSqlExecutor,
  organizationId: string,
  input: { thread: ThreadWrite; emails: EmailWrite[]; summaries?: SummaryWrite[] },
): Promise<void> {
  requireOrganizationId(organizationId);
  await sql.transaction(async (transaction) => {
    const repositories = createPostgresRepositories(transaction);
    await repositories.threads.upsert(organizationId, input.thread);
    for (const email of input.emails) await repositories.emails.upsert(organizationId, email);
    for (const summary of input.summaries ?? []) await repositories.summaries.upsert(organizationId, summary);
  });
}
