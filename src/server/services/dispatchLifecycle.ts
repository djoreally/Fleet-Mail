import { randomUUID } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import { FleetOperationsError } from './scheduleDispatch.js';

const transitions: Record<string, ReadonlySet<string>> = {
  assigned: new Set(['accepted', 'cancelled']),
  accepted: new Set(['en_route', 'cancelled']),
  en_route: new Set(['arrived', 'cancelled']),
  arrived: new Set(['working', 'cancelled']),
  working: new Set(['completed', 'cancelled']),
  completed: new Set(),
  cancelled: new Set(),
};

function connectionString() {
  const value = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new FleetOperationsError('Database is not configured', 503);
  return value;
}

export function nextDispatchStatuses(status: string): string[] {
  return [...(transitions[status] ?? new Set<string>())];
}

export function assertDispatchTransition(current: string, next: string) {
  if (current === next) return;
  const allowed = transitions[current];
  if (!allowed || !allowed.has(next)) {
    throw new FleetOperationsError(`Illegal dispatch transition: ${current} -> ${next}`, 409);
  }
}

export async function transitionDispatchStatus(input: {
  organizationId: string;
  dispatchId: string;
  nextStatus: string;
  actorUserId?: string | null;
  notes?: string | null;
}) {
  const pool = new Pool({ connectionString: connectionString() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query(
      `SELECT id,status,work_order_id,technician_id,appointment_id FROM public.dispatch_assignments WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
      [input.organizationId, input.dispatchId],
    );
    const current = currentResult.rows[0];
    if (!current) throw new FleetOperationsError('Dispatch not found', 404);
    const currentStatus = String(current.status);
    assertDispatchTransition(currentStatus, input.nextStatus);
    if (currentStatus === input.nextStatus) {
      await client.query('ROLLBACK');
      return current;
    }

    const arrivedAt = input.nextStatus === 'arrived' ? 'NOW()' : 'arrived_at';
    const completedAt = input.nextStatus === 'completed' ? 'NOW()' : 'completed_at';
    const updated = await client.query(
      `UPDATE public.dispatch_assignments
       SET status=$3, arrived_at=${arrivedAt}, completed_at=${completedAt}, updated_at=NOW()
       WHERE organization_id=$1 AND id=$2
       RETURNING *`,
      [input.organizationId, input.dispatchId, input.nextStatus],
    );
    await client.query(
      `INSERT INTO public.dispatch_status_history(id,organization_id,assignment_id,status,actor_user_id,notes,occurred_at)
       VALUES($1,$2,$3,$4,$5,$6,NOW())`,
      [randomUUID(), input.organizationId, input.dispatchId, input.nextStatus, input.actorUserId ?? null, input.notes ?? null],
    );
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* noop */ }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

export async function recordDispatchCreated(input: {
  organizationId: string;
  dispatchId: string;
  actorUserId?: string | null;
}) {
  const pool = new Pool({ connectionString: connectionString() });
  try {
    await pool.query(
      `INSERT INTO public.dispatch_status_history(id,organization_id,assignment_id,status,actor_user_id,occurred_at)
       VALUES($1,$2,$3,'assigned',$4,NOW())
       ON CONFLICT DO NOTHING`,
      [randomUUID(), input.organizationId, input.dispatchId, input.actorUserId ?? null],
    );
  } finally {
    await pool.end();
  }
}
