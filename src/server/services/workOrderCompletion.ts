import { and, eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { authorizations, inspections, serviceLines, workOrders } from '../../db/drizzleSchema.js';
import { workOrderExecutionService } from './workOrderExecution.js';

function database() {
  const db = getDb();
  if (!db) throw new Error('Database is not configured');
  return db;
}

export class WorkOrderCompletionService {
  async complete(organizationId: string, workOrderId: string) {
    const db = database();
    const [workOrder] = await db.select().from(workOrders)
      .where(and(eq(workOrders.organizationId, organizationId), eq(workOrders.id, workOrderId))).limit(1);
    if (!workOrder) throw new Error('Work order not found');
    if (['complete','completed'].includes(workOrder.status)) return workOrder;
    if (workOrder.status === 'cancelled') throw new Error('Cancelled work orders cannot be completed');

    const [inspectionRows, authorizationRows, lineRows] = await Promise.all([
      db.select().from(inspections).where(and(eq(inspections.organizationId, organizationId), eq(inspections.workOrderId, workOrderId))),
      db.select().from(authorizations).where(and(eq(authorizations.organizationId, organizationId), eq(authorizations.workOrderId, workOrderId))),
      db.select().from(serviceLines).where(and(eq(serviceLines.organizationId, organizationId), eq(serviceLines.workOrderId, workOrderId))),
    ]);

    if (!inspectionRows.some((row) => row.status === 'complete')) throw new Error('A completed inspection is required before work-order completion');
    if (inspectionRows.some((row) => row.status !== 'complete')) throw new Error('All started inspections must be completed');
    if (authorizationRows.some((row) => row.status === 'pending')) throw new Error('Pending authorizations must be decided before completion');

    const authorizedLines = lineRows.filter((row) => row.authorized);
    if (authorizedLines.some((row) => !row.completedAt)) throw new Error('All authorized service lines must be completed');
    if (lineRows.some((row) => !row.authorized && !row.completedAt)) throw new Error('Unresolved service lines must be authorized, removed, or completed before closing the work order');

    if (workOrder.status === 'in_progress') await workOrderExecutionService.transition(organizationId, workOrderId, 'review');
    const refreshed = await workOrderExecutionService.get(organizationId, workOrderId);
    if (!['review','authorized','in_progress'].includes(refreshed.workOrder.status)) throw new Error('Work order is not in a completable state');
    return workOrderExecutionService.transition(organizationId, workOrderId, 'completed');
  }
}

export const workOrderCompletionService = new WorkOrderCompletionService();
