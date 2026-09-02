import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import {
  authorizations,
  fluidUsage,
  inspectionItems,
  inspections,
  inventory,
  parts,
  partUsage,
  serviceLines,
  workOrders,
} from '../../db/drizzleSchema.js';

function database() {
  const db = getDb();
  if (!db) throw new Error('Database is not configured');
  return db;
}

const text = (value: unknown, field: string, max = 1000) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  return value.trim().slice(0, max);
};
const optional = (value: unknown, max = 1000) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
const nonNegative = (value: unknown, field: string, fallback = 0) => {
  const number = value == null || value === '' ? fallback : Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${field} must be zero or greater`);
  return number;
};

const EXECUTION_TRANSITIONS: Record<string, readonly string[]> = {
  scheduled: ['assigned','en_route','arrived','in_progress','cancelled'],
  assigned: ['en_route','arrived','in_progress','cancelled'],
  en_route: ['arrived','in_progress','cancelled'],
  arrived: ['in_progress','cancelled'],
  in_progress: ['review','authorization_pending','complete','cancelled'],
  review: ['authorization_pending','authorized','in_progress','complete','cancelled'],
  authorization_pending: ['authorized','review','cancelled'],
  authorized: ['in_progress','review','complete','cancelled'],
  complete: [],
  completed: [],
  cancelled: [],
};

export class WorkOrderExecutionService {
  private async workOrder(organizationId: string, workOrderId: string) {
    const [row] = await database().select().from(workOrders)
      .where(and(eq(workOrders.organizationId, organizationId), eq(workOrders.id, workOrderId))).limit(1);
    if (!row) throw new Error('Work order not found');
    return row;
  }

  async get(organizationId: string, workOrderId: string) {
    const db = database();
    const workOrder = await this.workOrder(organizationId, workOrderId);
    const [inspectionRows, authorizationRows, lineRows, partRows, fluidRows] = await Promise.all([
      db.select().from(inspections).where(and(eq(inspections.organizationId, organizationId), eq(inspections.workOrderId, workOrderId))).orderBy(desc(inspections.createdAt)),
      db.select().from(authorizations).where(and(eq(authorizations.organizationId, organizationId), eq(authorizations.workOrderId, workOrderId))).orderBy(desc(authorizations.createdAt)),
      db.select().from(serviceLines).where(and(eq(serviceLines.organizationId, organizationId), eq(serviceLines.workOrderId, workOrderId))).orderBy(serviceLines.createdAt),
      db.select({ usage: partUsage, partName: parts.name, sku: parts.sku }).from(partUsage)
        .leftJoin(parts, and(eq(parts.id, partUsage.partId), eq(parts.organizationId, organizationId)))
        .where(and(eq(partUsage.organizationId, organizationId), eq(partUsage.workOrderId, workOrderId))).orderBy(partUsage.createdAt),
      db.select().from(fluidUsage).where(and(eq(fluidUsage.organizationId, organizationId), eq(fluidUsage.workOrderId, workOrderId))).orderBy(fluidUsage.createdAt),
    ]);
    const itemsByInspection: Record<string, typeof inspectionItems.$inferSelect[]> = {};
    for (const inspection of inspectionRows) {
      itemsByInspection[inspection.id] = await db.select().from(inspectionItems)
        .where(and(eq(inspectionItems.organizationId, organizationId), eq(inspectionItems.inspectionId, inspection.id)))
        .orderBy(inspectionItems.position, inspectionItems.createdAt);
    }
    return {
      workOrder,
      inspections: inspectionRows.map((inspection) => ({ ...inspection, items: itemsByInspection[inspection.id] ?? [] })),
      authorizations: authorizationRows,
      serviceLines: lineRows,
      partUsage: partRows,
      fluidUsage: fluidRows,
    };
  }

  async transition(organizationId: string, workOrderId: string, nextStatus: string) {
    const row = await this.workOrder(organizationId, workOrderId);
    const allowed = EXECUTION_TRANSITIONS[row.status] ?? [];
    if (!allowed.includes(nextStatus)) throw new Error(`Invalid work-order transition: ${row.status} → ${nextStatus}`);
    const [updated] = await database().update(workOrders).set({
      status: nextStatus,
      ...(nextStatus === 'complete' ? { completedAt: new Date() } : {}),
      updatedAt: new Date(),
    }).where(and(eq(workOrders.organizationId, organizationId), eq(workOrders.id, workOrderId))).returning();
    return updated;
  }

  async startInspection(organizationId: string, workOrderId: string, input: Record<string, unknown>) {
    const row = await this.workOrder(organizationId, workOrderId);
    if (!['arrived','in_progress','review','authorized'].includes(row.status)) throw new Error('Inspection requires an arrived or active work order');
    const [created] = await database().insert(inspections).values({
      id: randomUUID(), organizationId, workOrderId,
      status: 'in_progress',
      odometer: input.odometer == null || input.odometer === '' ? row.odometer : Math.round(nonNegative(input.odometer, 'Odometer')),
      engineHours: input.engineHours == null || input.engineHours === '' ? row.engineHours : Math.round(nonNegative(input.engineHours, 'Engine hours')),
      results: {},
    }).returning();
    if (row.status === 'arrived') await this.transition(organizationId, workOrderId, 'in_progress');
    return created;
  }

  async addInspectionItem(organizationId: string, inspectionId: string, input: Record<string, unknown>) {
    const [inspection] = await database().select().from(inspections)
      .where(and(eq(inspections.organizationId, organizationId), eq(inspections.id, inspectionId))).limit(1);
    if (!inspection) throw new Error('Inspection not found');
    if (inspection.status === 'complete') throw new Error('Completed inspections are immutable');
    const [created] = await database().insert(inspectionItems).values({
      id: randomUUID(), organizationId, inspectionId,
      name: text(input.name, 'Inspection item', 200),
      condition: text(input.condition, 'Condition', 60),
      measurement: optional(input.measurement, 200),
      recommendation: optional(input.recommendation, 1000),
      severity: optional(input.severity, 40),
      photos: Array.isArray(input.photos) ? input.photos.slice(0, 20) : [],
      position: Math.round(nonNegative(input.position, 'Position', 0)),
    }).returning();
    return created;
  }

  async updateInspectionItem(organizationId: string, itemId: string, input: Record<string, unknown>) {
    const db = database();
    const [existing] = await db.select({ item: inspectionItems, inspectionStatus: inspections.status }).from(inspectionItems)
      .innerJoin(inspections, and(eq(inspections.id, inspectionItems.inspectionId), eq(inspections.organizationId, organizationId)))
      .where(and(eq(inspectionItems.organizationId, organizationId), eq(inspectionItems.id, itemId))).limit(1);
    if (!existing) throw new Error('Inspection item not found');
    if (existing.inspectionStatus === 'complete') throw new Error('Completed inspections are immutable');
    const [updated] = await db.update(inspectionItems).set({
      ...(input.name !== undefined ? { name: text(input.name, 'Inspection item', 200) } : {}),
      ...(input.condition !== undefined ? { condition: text(input.condition, 'Condition', 60) } : {}),
      ...(input.measurement !== undefined ? { measurement: optional(input.measurement, 200) } : {}),
      ...(input.recommendation !== undefined ? { recommendation: optional(input.recommendation, 1000) } : {}),
      ...(input.severity !== undefined ? { severity: optional(input.severity, 40) } : {}),
      ...(input.photos !== undefined ? { photos: Array.isArray(input.photos) ? input.photos.slice(0, 20) : [] } : {}),
      updatedAt: new Date(),
    }).where(and(eq(inspectionItems.organizationId, organizationId), eq(inspectionItems.id, itemId))).returning();
    return updated;
  }

  async completeInspection(organizationId: string, inspectionId: string) {
    const db = database();
    const [inspection] = await db.select().from(inspections)
      .where(and(eq(inspections.organizationId, organizationId), eq(inspections.id, inspectionId))).limit(1);
    if (!inspection) throw new Error('Inspection not found');
    const items = await db.select().from(inspectionItems)
      .where(and(eq(inspectionItems.organizationId, organizationId), eq(inspectionItems.inspectionId, inspectionId)));
    if (!items.length) throw new Error('Inspection must contain at least one item');
    const [updated] = await db.update(inspections).set({ status: 'complete', completedAt: new Date() })
      .where(and(eq(inspections.organizationId, organizationId), eq(inspections.id, inspectionId))).returning();
    const recommendations = items.filter((item) => item.recommendation && !['good','ok','pass'].includes(item.condition.toLowerCase()));
    const workOrder = await this.workOrder(organizationId, inspection.workOrderId);
    if (workOrder.status === 'in_progress') {
      await this.transition(organizationId, inspection.workOrderId, 'review');
    }
    return { inspection: updated, recommendationCount: recommendations.length };
  }

  async createAuthorization(organizationId: string, workOrderId: string, input: Record<string, unknown>) {
    const workOrder = await this.workOrder(organizationId, workOrderId);
    if (!['review','authorization_pending','authorized','in_progress'].includes(workOrder.status)) throw new Error('Work order is not ready for authorization');
    const [created] = await database().insert(authorizations).values({
      id: randomUUID(), organizationId, workOrderId,
      status: 'pending',
      amount: input.amount == null || input.amount === '' ? null : nonNegative(input.amount, 'Authorization amount').toFixed(2),
      purchaseOrderNumber: optional(input.purchaseOrderNumber, 100) ?? workOrder.purchaseOrderNumber,
      authorizedBy: optional(input.authorizedBy, 200),
      authorizationMethod: optional(input.authorizationMethod, 80),
      notes: optional(input.notes, 1000),
    }).returning();
    if (workOrder.status === 'review' || workOrder.status === 'in_progress') await this.transition(organizationId, workOrderId, 'authorization_pending');
    return created;
  }

  async decideAuthorization(organizationId: string, authorizationId: string, decision: 'authorized' | 'rejected', input: Record<string, unknown>) {
    const db = database();
    const [authorization] = await db.select().from(authorizations)
      .where(and(eq(authorizations.organizationId, organizationId), eq(authorizations.id, authorizationId))).limit(1);
    if (!authorization) throw new Error('Authorization not found');
    if (authorization.status !== 'pending') throw new Error('Authorization has already been decided');
    const [updated] = await db.update(authorizations).set({
      status: decision,
      authorizedBy: optional(input.authorizedBy, 200) ?? authorization.authorizedBy,
      authorizationMethod: optional(input.authorizationMethod, 80) ?? authorization.authorizationMethod,
      purchaseOrderNumber: optional(input.purchaseOrderNumber, 100) ?? authorization.purchaseOrderNumber,
      notes: optional(input.notes, 1000) ?? authorization.notes,
      authorizedAt: new Date(),
    }).where(and(eq(authorizations.organizationId, organizationId), eq(authorizations.id, authorizationId))).returning();
    if (decision === 'authorized') {
      await db.update(serviceLines).set({ authorized: true })
        .where(and(eq(serviceLines.organizationId, organizationId), eq(serviceLines.workOrderId, authorization.workOrderId)));
    }
    const workOrder = await this.workOrder(organizationId, authorization.workOrderId);
    if (workOrder.status === 'authorization_pending') await this.transition(organizationId, authorization.workOrderId, decision === 'authorized' ? 'authorized' : 'review');
    return updated;
  }

  async addServiceLine(organizationId: string, workOrderId: string, input: Record<string, unknown>) {
    const row = await this.workOrder(organizationId, workOrderId);
    if (['complete','completed','cancelled'].includes(row.status)) throw new Error('Closed work orders cannot be changed');
    const approvalRows = await database().select().from(authorizations)
      .where(and(eq(authorizations.organizationId, organizationId), eq(authorizations.workOrderId, workOrderId)));
    const hasPersistedApproval = approvalRows.some((approval) => approval.status === 'authorized');
    const [created] = await database().insert(serviceLines).values({
      id: randomUUID(), organizationId, workOrderId,
      description: text(input.description, 'Service description', 500),
      kind: optional(input.kind, 40) ?? 'labor',
      laborMinutes: Math.round(nonNegative(input.laborMinutes, 'Labor minutes', 0)),
      quantity: nonNegative(input.quantity, 'Quantity', 1).toFixed(3),
      unitPrice: nonNegative(input.unitPrice, 'Unit price', 0).toFixed(2),
      authorized: input.authorized === true && hasPersistedApproval,
      maintenanceScheduleId: optional(input.maintenanceScheduleId, 100),
    }).returning();
    return created;
  }

  async completeServiceLine(organizationId: string, lineId: string) {
    const [line] = await database().select().from(serviceLines)
      .where(and(eq(serviceLines.organizationId, organizationId), eq(serviceLines.id, lineId))).limit(1);
    if (!line) throw new Error('Service line not found');
    await this.workOrder(organizationId, line.workOrderId);
    if (!line.authorized) throw new Error('Service line must be authorized before completion');
    const [updated] = await database().update(serviceLines).set({ completedAt: new Date() })
      .where(and(eq(serviceLines.organizationId, organizationId), eq(serviceLines.id, lineId))).returning();
    return updated;
  }

  async addPartUsage(organizationId: string, workOrderId: string, input: Record<string, unknown>) {
    await this.workOrder(organizationId, workOrderId);
    const partId = text(input.partId, 'Part', 100);
    const [part] = await database().select().from(parts)
      .where(and(eq(parts.organizationId, organizationId), eq(parts.id, partId))).limit(1);
    if (!part) throw new Error('Part not found');
    const inventoryId = optional(input.inventoryId, 100);
    if (inventoryId) {
      const [stock] = await database().select().from(inventory)
        .where(and(eq(inventory.organizationId, organizationId), eq(inventory.id, inventoryId), eq(inventory.partId, partId))).limit(1);
      if (!stock) throw new Error('Inventory record not found for part');
    }
    const [created] = await database().insert(partUsage).values({
      id: randomUUID(), organizationId, workOrderId, partId, inventoryId,
      quantity: nonNegative(input.quantity, 'Quantity', 1).toFixed(3),
      unitCost: input.unitCost == null || input.unitCost === '' ? part.unitCost : nonNegative(input.unitCost, 'Unit cost').toFixed(2),
      sellPrice: input.sellPrice == null || input.sellPrice === '' ? part.unitPrice : nonNegative(input.sellPrice, 'Sell price').toFixed(2),
      lotSku: optional(input.lotSku, 100),
    }).returning();
    return created;
  }

  async addFluidUsage(organizationId: string, workOrderId: string, input: Record<string, unknown>) {
    await this.workOrder(organizationId, workOrderId);
    const [created] = await database().insert(fluidUsage).values({
      id: randomUUID(), organizationId, workOrderId,
      name: text(input.name, 'Fluid name', 200),
      specification: optional(input.specification, 200),
      viscosity: optional(input.viscosity, 100),
      quantity: nonNegative(input.quantity, 'Quantity', 1).toFixed(3),
      unitCost: input.unitCost == null || input.unitCost === '' ? null : nonNegative(input.unitCost, 'Unit cost').toFixed(2),
      sellPrice: input.sellPrice == null || input.sellPrice === '' ? null : nonNegative(input.sellPrice, 'Sell price').toFixed(2),
    }).returning();
    return created;
  }
}

export const workOrderExecutionService = new WorkOrderExecutionService();