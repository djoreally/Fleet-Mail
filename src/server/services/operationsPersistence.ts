import { and, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/index.js';
import { customers, maintenanceEvents, maintenanceSchedules, organizations, vehicles, workOrders } from '../../db/drizzleSchema.js';

export type DueState = 'overdue' | 'due_soon' | 'upcoming' | 'unknown';
export const WORK_ORDER_STATUSES = ['draft','scheduled','assigned','en_route','arrived','in_progress','review','authorization_pending','authorized','complete','completed','cancelled'] as const;

export function calculateDueState(nextDueAt: Date | null, nextDueMileage: number | null, mileage: number | null, now = new Date()): DueState {
  const milesLeft = nextDueMileage == null || mileage == null ? null : nextDueMileage - mileage;
  const daysLeft = nextDueAt == null ? null : (nextDueAt.getTime() - now.getTime()) / 86_400_000;
  if (milesLeft == null && daysLeft == null) return 'unknown';
  if ((milesLeft != null && milesLeft <= 0) || (daysLeft != null && daysLeft <= 0)) return 'overdue';
  if ((milesLeft != null && milesLeft <= 500) || (daysLeft != null && daysLeft <= 30)) return 'due_soon';
  return 'upcoming';
}

function database() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL is not configured');
  return db;
}

export async function resolveOperationsOrganization(requested?: string) {
  const configured = process.env.DEFAULT_ORGANIZATION_ID?.trim();
  const organizationId = requested?.trim() || configured;
  const db = database();
  if (organizationId) {
    const [match] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (!match) throw new Error('Organization was not found');
    return match.id;
  }
  const [first] = await db.select({ id: organizations.id }).from(organizations).orderBy(organizations.createdAt).limit(1);
  if (!first) throw new Error('No Fleet OS organization has been provisioned');
  return first.id;
}

export async function listWorkOrders(organizationId: string) {
  const db = database();
  return db.select({
    id: workOrders.id, number: workOrders.number, status: workOrders.status, priority: workOrders.priority,
    complaint: workOrders.complaint, diagnosis: workOrders.diagnosis, completedAt: workOrders.completedAt,
    scheduledAt: workOrders.scheduledAt, technicianId: workOrders.technicianId,
    odometer: workOrders.odometer, engineHours: workOrders.engineHours,
    purchaseOrderNumber: workOrders.purchaseOrderNumber, requestedServices: workOrders.requestedServices,
    customerNotes: workOrders.customerNotes, technicianNotes: workOrders.technicianNotes,
    laborMinutes: workOrders.laborMinutes, travelMinutes: workOrders.travelMinutes,
    locationId: workOrders.locationId,
    createdAt: workOrders.createdAt, updatedAt: workOrders.updatedAt,
    vehicleId: vehicles.id, unitNumber: vehicles.unitNumber, year: vehicles.year, make: vehicles.make, model: vehicles.model,
    customerId: customers.id, customerName: customers.name,
  }).from(workOrders)
    .leftJoin(vehicles, and(eq(vehicles.id, workOrders.vehicleId), eq(vehicles.organizationId, organizationId)))
    .leftJoin(customers, and(eq(customers.id, workOrders.customerId), eq(customers.organizationId, organizationId)))
    .where(eq(workOrders.organizationId, organizationId)).orderBy(desc(workOrders.updatedAt));
}

const requestedServicesFrom = (value: unknown) => value == null ? [] : Array.isArray(value) ? value.map(String).map(v=>v.trim()).filter(Boolean) : String(value).split(/[,\n]/).map(v=>v.trim()).filter(Boolean);
const optionalNumber = (value: unknown) => value === '' || value == null ? null : Number(value);

export async function createWorkOrder(organizationId: string, input: Record<string, unknown>) {
  const db = database();
  const vehicleId = String(input.vehicleId || '');
  if (!vehicleId) throw new Error('vehicleId is required');
  const [vehicle] = await db.select({ id: vehicles.id, customerId: vehicles.customerId }).from(vehicles)
    .where(and(eq(vehicles.organizationId, organizationId), eq(vehicles.id, vehicleId))).limit(1);
  if (!vehicle) throw new Error('Vehicle was not found in this organization');
  const generatedNumber = `WO-${new Date().getUTCFullYear()}-${Date.now().toString().slice(-6)}`;
  const status = String(input.status || 'scheduled');
  if (!WORK_ORDER_STATUSES.includes(status as typeof WORK_ORDER_STATUSES[number])) throw new Error('Invalid work order status');
  const [created] = await db.insert(workOrders).values({
    id: randomUUID(), organizationId, vehicleId, customerId: vehicle.customerId,
    number: String(input.number || generatedNumber), status,
    priority: String(input.priority || 'routine'), complaint: input.complaint ? String(input.complaint) : null,
    requestedServices: requestedServicesFrom(input.requestedServices),
    purchaseOrderNumber: input.purchaseOrderNumber ? String(input.purchaseOrderNumber) : null,
    odometer: optionalNumber(input.odometer), engineHours: optionalNumber(input.engineHours),
    customerNotes: input.customerNotes ? String(input.customerNotes) : null,
    technicianNotes: input.technicianNotes ? String(input.technicianNotes) : null,
    scheduledAt: input.scheduledAt ? new Date(String(input.scheduledAt)) : null,
  }).returning();
  return created;
}

export async function updateWorkOrder(organizationId: string, id: string, input: Record<string, unknown>) {
  const db = database();
  const status = input.status == null ? undefined : String(input.status);
  if (status && !WORK_ORDER_STATUSES.includes(status as typeof WORK_ORDER_STATUSES[number])) throw new Error('Invalid work order status');
  const requestedServices = input.requestedServices == null ? undefined : requestedServicesFrom(input.requestedServices);
  const [updated] = await db.update(workOrders).set({
    ...(status ? { status } : {}),
    ...(input.priority != null ? { priority: String(input.priority) } : {}),
    ...(input.complaint != null ? { complaint: String(input.complaint) } : {}),
    ...(input.diagnosis != null ? { diagnosis: String(input.diagnosis) } : {}),
    ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt ? new Date(String(input.scheduledAt)) : null } : {}),
    ...(input.technicianId !== undefined ? { technicianId: input.technicianId ? String(input.technicianId) : null } : {}),
    ...(input.locationId !== undefined ? { locationId: input.locationId ? String(input.locationId) : null } : {}),
    ...(input.odometer !== undefined ? { odometer: optionalNumber(input.odometer) } : {}),
    ...(input.engineHours !== undefined ? { engineHours: optionalNumber(input.engineHours) } : {}),
    ...(input.purchaseOrderNumber !== undefined ? { purchaseOrderNumber: input.purchaseOrderNumber ? String(input.purchaseOrderNumber) : null } : {}),
    ...(requestedServices !== undefined ? { requestedServices } : {}),
    ...(input.customerNotes !== undefined ? { customerNotes: input.customerNotes ? String(input.customerNotes) : null } : {}),
    ...(input.technicianNotes !== undefined ? { technicianNotes: input.technicianNotes ? String(input.technicianNotes) : null } : {}),
    ...(input.laborMinutes !== undefined ? { laborMinutes: Number(input.laborMinutes || 0) } : {}),
    ...(input.travelMinutes !== undefined ? { travelMinutes: Number(input.travelMinutes || 0) } : {}),
    ...((status === 'complete' || status === 'completed') ? { completedAt: new Date() } : {}),
    updatedAt: new Date(),
  }).where(and(eq(workOrders.organizationId, organizationId), eq(workOrders.id, id))).returning();
  if (!updated) throw new Error('Work order was not found');
  return updated;
}

export async function deleteWorkOrder(organizationId: string, id: string) {
  const db = database();
  const deleted = await db.delete(workOrders).where(and(eq(workOrders.organizationId, organizationId), eq(workOrders.id, id))).returning();
  return deleted.length > 0;
}

export async function listMaintenance(organizationId: string) {
  const db = database();
  const rows = await db.select({
    id: maintenanceSchedules.id, vehicleId: maintenanceSchedules.vehicleId, serviceCode: maintenanceSchedules.serviceCode,
    intervalMiles: maintenanceSchedules.intervalMiles, intervalDays: maintenanceSchedules.intervalDays,
    nextDueMileage: maintenanceSchedules.nextDueMileage, nextDueAt: maintenanceSchedules.nextDueAt, active: maintenanceSchedules.active,
    unitNumber: vehicles.unitNumber, mileage: vehicles.mileage, year: vehicles.year, make: vehicles.make, model: vehicles.model,
  }).from(maintenanceSchedules).innerJoin(vehicles, and(eq(vehicles.id, maintenanceSchedules.vehicleId), eq(vehicles.organizationId, organizationId)))
    .where(eq(maintenanceSchedules.organizationId, organizationId)).orderBy(maintenanceSchedules.nextDueAt);
  return rows.map(row => ({ ...row, dueState: calculateDueState(row.nextDueAt, row.nextDueMileage, row.mileage) }));
}

export async function createMaintenanceSchedule(organizationId: string, input: Record<string, unknown>) {
  const db = database();
  const vehicleId = String(input.vehicleId || '');
  const serviceCode = String(input.serviceCode || '').trim();
  if (!vehicleId || !serviceCode) throw new Error('vehicleId and serviceCode are required');
  const [vehicle] = await db.select({ id: vehicles.id, mileage: vehicles.mileage }).from(vehicles)
    .where(and(eq(vehicles.organizationId, organizationId), eq(vehicles.id, vehicleId))).limit(1);
  if (!vehicle) throw new Error('Vehicle was not found in this organization');
  const intervalMiles = input.intervalMiles == null ? null : Number(input.intervalMiles);
  const intervalDays = input.intervalDays == null ? null : Number(input.intervalDays);
  if (!intervalMiles && !intervalDays) throw new Error('At least one maintenance interval is required');
  const [created] = await db.insert(maintenanceSchedules).values({
    id: randomUUID(), organizationId, vehicleId, serviceCode, intervalMiles, intervalDays,
    nextDueMileage: input.nextDueMileage == null ? (intervalMiles && vehicle.mileage != null ? vehicle.mileage + intervalMiles : null) : Number(input.nextDueMileage),
    nextDueAt: input.nextDueAt ? new Date(String(input.nextDueAt)) : (intervalDays ? new Date(Date.now() + intervalDays * 86_400_000) : null),
  }).returning();
  return created;
}

export async function completeMaintenance(organizationId: string, scheduleId: string, input: Record<string, unknown>) {
  const db = database();
  const [schedule] = await db.select().from(maintenanceSchedules)
    .where(and(eq(maintenanceSchedules.organizationId, organizationId), eq(maintenanceSchedules.id, scheduleId))).limit(1);
  if (!schedule) throw new Error('Maintenance schedule was not found');
  const mileage = input.mileage == null ? null : Number(input.mileage);
  const occurredAt = input.occurredAt ? new Date(String(input.occurredAt)) : new Date();
  const [event] = await db.insert(maintenanceEvents).values({
    id: randomUUID(), organizationId, scheduleId, vehicleId: schedule.vehicleId, workOrderId: input.workOrderId ? String(input.workOrderId) : null,
    eventType: 'completed', mileage, occurredAt, notes: input.notes ? String(input.notes) : null,
  }).returning();
  await db.update(maintenanceSchedules).set({
    nextDueMileage: schedule.intervalMiles && mileage != null ? mileage + schedule.intervalMiles : schedule.nextDueMileage,
    nextDueAt: schedule.intervalDays ? new Date(occurredAt.getTime() + schedule.intervalDays * 86_400_000) : schedule.nextDueAt,
    updatedAt: new Date(),
  }).where(and(eq(maintenanceSchedules.organizationId, organizationId), eq(maintenanceSchedules.id, scheduleId)));
  if (mileage != null) await db.update(vehicles).set({ mileage, updatedAt: new Date() }).where(and(eq(vehicles.organizationId, organizationId), eq(vehicles.id, schedule.vehicleId), sql`${vehicles.mileage} IS NULL OR ${vehicles.mileage} <= ${mileage}`));
  return event;
}
