import { Pool } from '@neondatabase/serverless';
import type { Request } from 'express';
import { FleetAuthError, getFleetAccessContext } from './fleetAuth.js';

function connectionString() {
  const value = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new FleetAuthError(503, 'Production database is not configured');
  return value;
}

export type TechnicianScope = { role: string; userId: string | null; technicianId: string | null; isTechnician: boolean };

export async function getTechnicianScope(req: Request, organizationId: string): Promise<TechnicianScope> {
  const access = await getFleetAccessContext(req);
  if (access.role !== 'technician') return { role: access.role, userId: access.userId, technicianId: null, isTechnician: false };
  if (!access.userId) throw new FleetAuthError(403, 'Technician identity is incomplete');
  const pool = new Pool({ connectionString: connectionString() });
  try {
    const result = await pool.query(`SELECT id FROM public.technicians WHERE organization_id=$1 AND user_id=$2 AND active=true LIMIT 1`, [organizationId, access.userId]);
    const technicianId = result.rows[0]?.id ? String(result.rows[0].id) : null;
    if (!technicianId) throw new FleetAuthError(403, 'No active technician profile is linked to this account');
    return { role: access.role, userId: access.userId, technicianId, isTechnician: true };
  } finally { await pool.end(); }
}

export async function assertAssignedWorkOrder(req: Request, organizationId: string, workOrderId: string) {
  const scope = await getTechnicianScope(req, organizationId);
  if (!scope.isTechnician) return scope;
  const pool = new Pool({ connectionString: connectionString() });
  try {
    const result = await pool.query(`SELECT 1 FROM public.work_orders WHERE organization_id=$1 AND id=$2 AND technician_id=$3 LIMIT 1`, [organizationId, workOrderId, scope.technicianId]);
    if (!result.rowCount) throw new FleetAuthError(403, 'Technicians may only access work orders assigned to them');
    return scope;
  } finally { await pool.end(); }
}

export async function assertAssignedSubresource(req: Request, organizationId: string, kind: 'inspection'|'inspection_item'|'authorization'|'service_line', id: string) {
  const scope = await getTechnicianScope(req, organizationId);
  if (!scope.isTechnician) return scope;
  const queries = {
    inspection: `SELECT work_order_id AS "workOrderId" FROM public.inspections WHERE organization_id=$1 AND id=$2 LIMIT 1`,
    inspection_item: `SELECT i.work_order_id AS "workOrderId" FROM public.inspection_items x JOIN public.inspections i ON i.organization_id=x.organization_id AND i.id=x.inspection_id WHERE x.organization_id=$1 AND x.id=$2 LIMIT 1`,
    authorization: `SELECT work_order_id AS "workOrderId" FROM public.authorizations WHERE organization_id=$1 AND id=$2 LIMIT 1`,
    service_line: `SELECT work_order_id AS "workOrderId" FROM public.service_lines WHERE organization_id=$1 AND id=$2 LIMIT 1`,
  } as const;
  const pool = new Pool({ connectionString: connectionString() });
  try {
    const found = await pool.query(queries[kind], [organizationId, id]);
    const workOrderId = found.rows[0]?.workOrderId ? String(found.rows[0].workOrderId) : null;
    if (!workOrderId) throw new FleetAuthError(404, 'Work-order resource not found');
    const assigned = await pool.query(`SELECT 1 FROM public.work_orders WHERE organization_id=$1 AND id=$2 AND technician_id=$3 LIMIT 1`, [organizationId, workOrderId, scope.technicianId]);
    if (!assigned.rowCount) throw new FleetAuthError(403, 'Technicians may only access resources on work orders assigned to them');
    return scope;
  } finally { await pool.end(); }
}
