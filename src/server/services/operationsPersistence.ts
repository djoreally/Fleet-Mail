import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/index.js';
import { customers, maintenanceEvents, maintenanceSchedules, organizations, vehicles, workOrders } from '../../db/drizzleSchema.js';

export type DueState = 'overdue' | 'due_soon' | 'upcoming' | 'unknown';

export function calculateDueState(nextDueAt: Date | null, nextDueMileage: number | null, mileage: number | null, now = new Date(), nextDueEngineHours: number | null = null, engineHours: number | null = null): DueState {
  const milesLeft = nextDueMileage == null || mileage == null ? null : nextDueMileage - mileage;
  const hoursLeft = nextDueEngineHours == null || engineHours == null ? null : nextDueEngineHours - engineHours;
  const daysLeft = nextDueAt == null ? null : (nextDueAt.getTime() - now.getTime()) / 86_400_000;
  if (milesLeft == null && hoursLeft == null && daysLeft == null) return 'unknown';
  if ((milesLeft != null && milesLeft <= 0) || (hoursLeft != null && hoursLeft <= 0) || (daysLeft != null && daysLeft <= 0)) return 'overdue';
  if ((milesLeft != null && milesLeft <= 500) || (hoursLeft != null && hoursLeft <= 25) || (daysLeft != null && daysLeft <= 30)) return 'due_soon';
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
    createdAt: workOrders.createdAt, updatedAt: workOrders.updatedAt,
    vehicleId: vehicles.id, unitNumber: vehicles.unitNumber, year: vehicles.year, make: vehicles.make, model: vehicles.model,
    customerId: customers.id, customerName: customers.name,
  }).from(workOrders)
    .leftJoin(vehicles, and(eq(vehicles.id, workOrders.vehicleId), eq(vehicles.organizationId, organizationId)))
    .leftJoin(customers, and(eq(customers.id, workOrders.customerId), eq(customers.organizationId, organizationId)))
    .where(eq(workOrders.organizationId, organizationId)).orderBy(desc(workOrders.updatedAt));
}

export async function createWorkOrder(organizationId: string, input: Record<string, unknown>) {
  const db = database();
  const vehicleId = String(input.vehicleId || '');
  if (!vehicleId) throw new Error('vehicleId is required');
  const [vehicle] = await db.select({ id: vehicles.id, customerId: vehicles.customerId }).from(vehicles)
    .where(and(eq(vehicles.organizationId, organizationId), eq(vehicles.id, vehicleId))).limit(1);
  if (!vehicle) throw new Error('Vehicle was not found in this organization');
  const generatedNumber = `WO-${new Date().getUTCFullYear()}-${Date.now().toString().slice(-6)}`;
  const [created] = await db.insert(workOrders).values({
    id: randomUUID(), organizationId, vehicleId, customerId: vehicle.customerId,
    number: String(input.number || generatedNumber), status: String(input.status || 'scheduled'),
    priority: String(input.priority || 'routine'), complaint: input.complaint ? String(input.complaint) : null,
    scheduledAt: input.scheduledAt ? new Date(String(input.scheduledAt)) : null,
    locationId: input.locationId ? String(input.locationId) : null,
    odometer: input.odometer == null ? null : Number(input.odometer), engineHours: input.engineHours == null ? null : Number(input.engineHours),
    purchaseOrderNumber: input.purchaseOrderNumber ? String(input.purchaseOrderNumber) : null,
    requestedServices: Array.isArray(input.requestedServices) ? input.requestedServices.map(String) : String(input.requestedServices || '').split(/[,\n]/).map(value => value.trim()).filter(Boolean),
    customerNotes: input.customerNotes ? String(input.customerNotes) : null,
  }).returning();
  return created;
}

export async function updateWorkOrder(organizationId: string, id: string, input: Record<string, unknown>) {
  const db = database();
  const allowedStatus = ['scheduled','assigned','en_route','arrived','in_progress','review','complete','cancelled','intake','inspection_pending','inspection_complete','authorization_pending','authorized','service_in_progress','completed'];
  const status = input.status == null ? undefined : String(input.status);
  if (status && !allowedStatus.includes(status)) throw new Error('Invalid work order status');
  const [updated] = await db.update(workOrders).set({
    ...(status ? { status } : {}),
    ...(input.priority != null ? { priority: String(input.priority) } : {}),
    ...(input.complaint != null ? { complaint: String(input.complaint) } : {}),
    ...(input.diagnosis != null ? { diagnosis: String(input.diagnosis) } : {}),
    ...(status === 'completed' || status === 'complete' ? { completedAt: new Date() } : {}),
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
    program: maintenanceSchedules.program, intervalMiles: maintenanceSchedules.intervalMiles, intervalDays: maintenanceSchedules.intervalDays, intervalEngineHours: maintenanceSchedules.intervalEngineHours,
    lastServiceMileage: maintenanceSchedules.lastServiceMileage, lastServiceEngineHours: maintenanceSchedules.lastServiceEngineHours, lastServiceAt: maintenanceSchedules.lastServiceAt,
    nextDueMileage: maintenanceSchedules.nextDueMileage, nextDueEngineHours: maintenanceSchedules.nextDueEngineHours, nextDueAt: maintenanceSchedules.nextDueAt, active: maintenanceSchedules.active,
    unitNumber: vehicles.unitNumber, mileage: vehicles.mileage, engineHours: vehicles.engineHours, year: vehicles.year, make: vehicles.make, model: vehicles.model,
  }).from(maintenanceSchedules).innerJoin(vehicles, and(eq(vehicles.id, maintenanceSchedules.vehicleId), eq(vehicles.organizationId, organizationId)))
    .where(eq(maintenanceSchedules.organizationId, organizationId)).orderBy(maintenanceSchedules.nextDueAt);
  return rows.map(row => ({ ...row, dueState: calculateDueState(row.nextDueAt, row.nextDueMileage, row.mileage, new Date(), row.nextDueEngineHours, row.engineHours) }));
}

export async function createMaintenanceSchedule(organizationId: string, input: Record<string, unknown>) {
  const db = database();
  const vehicleId = String(input.vehicleId || '');
  const serviceCode = String(input.serviceCode || '').trim();
  if (!vehicleId || !serviceCode) throw new Error('vehicleId and serviceCode are required');
  const [vehicle] = await db.select({ id: vehicles.id, mileage: vehicles.mileage, engineHours: vehicles.engineHours }).from(vehicles)
    .where(and(eq(vehicles.organizationId, organizationId), eq(vehicles.id, vehicleId))).limit(1);
  if (!vehicle) throw new Error('Vehicle was not found in this organization');
  const intervalMiles = input.intervalMiles == null ? null : Number(input.intervalMiles);
  const intervalDays = input.intervalDays == null ? null : Number(input.intervalDays);
  const intervalEngineHours = input.intervalEngineHours == null ? null : Number(input.intervalEngineHours);
  if (!intervalMiles && !intervalDays && !intervalEngineHours) throw new Error('At least one maintenance interval is required');
  const [created] = await db.insert(maintenanceSchedules).values({
    id: randomUUID(), organizationId, vehicleId, serviceCode, program: input.program ? String(input.program) : null, intervalMiles, intervalDays, intervalEngineHours,
    lastServiceMileage: input.lastServiceMileage == null ? vehicle.mileage : Number(input.lastServiceMileage), lastServiceEngineHours: input.lastServiceEngineHours == null ? vehicle.engineHours : Number(input.lastServiceEngineHours), lastServiceAt: input.lastServiceAt ? new Date(String(input.lastServiceAt)) : null,
    nextDueEngineHours: input.nextDueEngineHours == null ? (intervalEngineHours && vehicle.engineHours != null ? vehicle.engineHours + intervalEngineHours : null) : Number(input.nextDueEngineHours),
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
  const engineHours = input.engineHours == null ? null : Number(input.engineHours);
  const occurredAt = input.occurredAt ? new Date(String(input.occurredAt)) : new Date();
  const [event] = await db.insert(maintenanceEvents).values({
    id: randomUUID(), organizationId, scheduleId, vehicleId: schedule.vehicleId, workOrderId: input.workOrderId ? String(input.workOrderId) : null,
    eventType: 'completed', mileage, occurredAt, notes: input.notes ? String(input.notes) : null,
  }).returning();
  await db.update(maintenanceSchedules).set({
    lastServiceMileage: mileage ?? schedule.lastServiceMileage, lastServiceEngineHours: engineHours ?? schedule.lastServiceEngineHours, lastServiceAt: occurredAt,
    nextDueMileage: schedule.intervalMiles && mileage != null ? mileage + schedule.intervalMiles : schedule.nextDueMileage,
    nextDueEngineHours: schedule.intervalEngineHours && engineHours != null ? engineHours + schedule.intervalEngineHours : schedule.nextDueEngineHours,
    nextDueAt: schedule.intervalDays ? new Date(occurredAt.getTime() + schedule.intervalDays * 86_400_000) : schedule.nextDueAt,
    updatedAt: new Date(),
  }).where(and(eq(maintenanceSchedules.organizationId, organizationId), eq(maintenanceSchedules.id, scheduleId)));
  if (mileage != null || engineHours != null) await db.update(vehicles).set({ ...(mileage != null ? { mileage } : {}), ...(engineHours != null ? { engineHours } : {}), updatedAt: new Date() }).where(and(eq(vehicles.organizationId, organizationId), eq(vehicles.id, schedule.vehicleId)));
  return event;
}
