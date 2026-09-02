import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { contacts, customers, emailThreads, inspectionItems, inspections, invoices, locations, maintenanceSchedules, vehicles, workOrders } from '../../db/drizzleSchema.js';
import { prospectActivities, prospectContacts, prospects } from '../../db/prospectSchema.js';

function database() {
  const db = getDb();
  if (!db) throw new Error('Database is not configured');
  return db;
}

const OPEN_WORK_ORDER_STATUSES = new Set(['draft','scheduled','assigned','en_route','arrived','in_progress','review','authorization_pending','authorized']);
const GOOD_CONDITIONS = new Set(['good','ok','pass']);

function scheduleIsDue(schedule: typeof maintenanceSchedules.$inferSelect, vehicle: typeof vehicles.$inferSelect | undefined) {
  if (!schedule.active || !vehicle) return false;
  if (schedule.nextDueAt && schedule.nextDueAt.getTime() <= Date.now()) return true;
  if (schedule.nextDueMileage != null && vehicle.mileage != null && schedule.nextDueMileage <= vehicle.mileage) return true;
  if (schedule.nextDueEngineHours != null && vehicle.engineHours != null && schedule.nextDueEngineHours <= vehicle.engineHours) return true;
  return false;
}

export class FleetAccount360Service {
  async get(organizationId: string, customerId: string) {
    const db = database();
    const [account] = await db.select().from(customers)
      .where(and(eq(customers.organizationId, organizationId), eq(customers.id, customerId))).limit(1);
    if (!account) throw new Error('Fleet account not found');

    const [contactRows, locationRows, vehicleRows, workOrderRows, invoiceRows, threadRows, sourceProspectRows] = await Promise.all([
      db.select().from(contacts)
        .where(and(eq(contacts.organizationId, organizationId), eq(contacts.customerId, customerId)))
        .orderBy(desc(contacts.isPrimary), contacts.name),
      db.select().from(locations)
        .where(and(eq(locations.organizationId, organizationId), eq(locations.customerId, customerId)))
        .orderBy(locations.name),
      db.select().from(vehicles)
        .where(and(eq(vehicles.organizationId, organizationId), eq(vehicles.customerId, customerId)))
        .orderBy(vehicles.unitNumber),
      db.select().from(workOrders)
        .where(and(eq(workOrders.organizationId, organizationId), eq(workOrders.customerId, customerId)))
        .orderBy(desc(workOrders.updatedAt)).limit(200),
      db.select().from(invoices)
        .where(and(eq(invoices.organizationId, organizationId), eq(invoices.customerId, customerId)))
        .orderBy(desc(invoices.createdAt)).limit(200),
      db.select({ id: emailThreads.id, subject: emailThreads.subject, workOrderId: emailThreads.workOrderId, lastMessageAt: emailThreads.lastMessageAt, updatedAt: emailThreads.updatedAt })
        .from(emailThreads)
        .where(and(eq(emailThreads.organizationId, organizationId), eq(emailThreads.customerId, customerId)))
        .orderBy(desc(emailThreads.lastMessageAt)).limit(100),
      db.select().from(prospects)
        .where(and(eq(prospects.organizationId, organizationId), eq(prospects.convertedCustomerId, customerId)))
        .orderBy(desc(prospects.convertedAt)).limit(20),
    ]);

    const vehicleIds = vehicleRows.map((row) => row.id);
    const workOrderIds = workOrderRows.map((row) => row.id);
    const sourceProspectIds = sourceProspectRows.map((row) => row.id);
    const [scheduleRows, inspectionRows, sourceProspectContactRows, sourceProspectActivityRows] = await Promise.all([
      vehicleIds.length
        ? db.select().from(maintenanceSchedules)
            .where(and(eq(maintenanceSchedules.organizationId, organizationId), inArray(maintenanceSchedules.vehicleId, vehicleIds)))
            .orderBy(maintenanceSchedules.nextDueAt)
        : Promise.resolve([]),
      workOrderIds.length
        ? db.select().from(inspections)
            .where(and(eq(inspections.organizationId, organizationId), inArray(inspections.workOrderId, workOrderIds)))
            .orderBy(desc(inspections.createdAt))
        : Promise.resolve([]),
      sourceProspectIds.length
        ? db.select().from(prospectContacts)
            .where(and(eq(prospectContacts.organizationId, organizationId), inArray(prospectContacts.prospectId, sourceProspectIds)))
            .orderBy(desc(prospectContacts.isDecisionMaker), prospectContacts.name)
        : Promise.resolve([]),
      sourceProspectIds.length
        ? db.select().from(prospectActivities)
            .where(and(eq(prospectActivities.organizationId, organizationId), inArray(prospectActivities.prospectId, sourceProspectIds)))
            .orderBy(desc(prospectActivities.occurredAt)).limit(500)
        : Promise.resolve([]),
    ]);

    const inspectionIds = inspectionRows.map((row) => row.id);
    const itemRows = inspectionIds.length
      ? await db.select().from(inspectionItems)
          .where(and(eq(inspectionItems.organizationId, organizationId), inArray(inspectionItems.inspectionId, inspectionIds)))
          .orderBy(desc(inspectionItems.updatedAt))
      : [];

    const vehicleById = new Map(vehicleRows.map((row) => [row.id, row]));
    const dueMaintenance = scheduleRows.filter((schedule) => scheduleIsDue(schedule, vehicleById.get(schedule.vehicleId)));
    const activeRecommendations = itemRows.filter((item) => Boolean(item.recommendation) && !GOOD_CONDITIONS.has(String(item.condition).toLowerCase()));
    const openWorkOrders = workOrderRows.filter((row) => OPEN_WORK_ORDER_STATUSES.has(row.status));
    const outstandingBalance = invoiceRows.reduce((sum, row) => sum + Number(row.balanceDue || 0), 0);
    const lifetimeInvoiced = invoiceRows
      .filter((row) => !['draft','void'].includes(row.status))
      .reduce((sum, row) => sum + Number(row.total || 0), 0);

    const revenueHistory = sourceProspectRows.map((prospect) => ({
      prospect,
      contacts: sourceProspectContactRows.filter((row) => row.prospectId === prospect.id),
      activities: sourceProspectActivityRows.filter((row) => row.prospectId === prospect.id),
    }));

    return {
      account,
      summary: {
        contacts: contactRows.length,
        locations: locationRows.length,
        vehicles: vehicleRows.length,
        activeVehicles: vehicleRows.filter((row) => row.status === 'active').length,
        maintenanceSchedules: scheduleRows.filter((row) => row.active).length,
        dueMaintenance: dueMaintenance.length,
        openWorkOrders: openWorkOrders.length,
        inspections: inspectionRows.length,
        activeRecommendations: activeRecommendations.length,
        outstandingBalance: outstandingBalance.toFixed(2),
        lifetimeInvoiced: lifetimeInvoiced.toFixed(2),
        communicationThreads: threadRows.length,
        sourceProspects: sourceProspectRows.length,
        prospectActivities: sourceProspectActivityRows.length,
      },
      contacts: contactRows,
      locations: locationRows,
      vehicles: vehicleRows,
      maintenanceSchedules: scheduleRows,
      dueMaintenance,
      workOrders: workOrderRows,
      inspections: inspectionRows.map((inspection) => ({ ...inspection, items: itemRows.filter((item) => item.inspectionId === inspection.id) })),
      recommendations: activeRecommendations,
      invoices: invoiceRows,
      communications: threadRows,
      revenueHistory,
    };
  }
}

export const fleetAccount360Service = new FleetAccount360Service();
