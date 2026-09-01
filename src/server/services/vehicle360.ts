import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { customers, inspectionItems, inspections, locations, maintenanceEvents, maintenanceSchedules, vehicles, workOrders } from '../../db/drizzleSchema.js';

function database() {
  const db = getDb();
  if (!db) throw new Error('Database is not configured');
  return db;
}

export class Vehicle360Service {
  async get(organizationId: string, vehicleId: string) {
    const db = database();
    const [vehicle] = await db.select().from(vehicles)
      .where(and(eq(vehicles.organizationId, organizationId), eq(vehicles.id, vehicleId))).limit(1);
    if (!vehicle) throw new Error('Vehicle not found');

    const [accountRows, locationRows, scheduleRows, eventRows, workOrderRows] = await Promise.all([
      vehicle.customerId
        ? db.select({ id: customers.id, name: customers.name, accountNumber: customers.accountNumber, status: customers.status })
            .from(customers).where(and(eq(customers.organizationId, organizationId), eq(customers.id, vehicle.customerId))).limit(1)
        : Promise.resolve([]),
      vehicle.locationId
        ? db.select().from(locations).where(and(eq(locations.organizationId, organizationId), eq(locations.id, vehicle.locationId))).limit(1)
        : Promise.resolve([]),
      db.select().from(maintenanceSchedules)
        .where(and(eq(maintenanceSchedules.organizationId, organizationId), eq(maintenanceSchedules.vehicleId, vehicleId)))
        .orderBy(maintenanceSchedules.nextDueAt),
      db.select().from(maintenanceEvents)
        .where(and(eq(maintenanceEvents.organizationId, organizationId), eq(maintenanceEvents.vehicleId, vehicleId)))
        .orderBy(desc(maintenanceEvents.occurredAt)).limit(100),
      db.select().from(workOrders)
        .where(and(eq(workOrders.organizationId, organizationId), eq(workOrders.vehicleId, vehicleId)))
        .orderBy(desc(workOrders.updatedAt)).limit(100),
    ]);

    const workOrderIds = workOrderRows.map((row) => row.id);
    const inspectionRows = workOrderIds.length
      ? await db.select().from(inspections)
          .where(and(eq(inspections.organizationId, organizationId), inArray(inspections.workOrderId, workOrderIds)))
          .orderBy(desc(inspections.createdAt))
      : [];
    const inspectionIds = inspectionRows.map((row) => row.id);
    const itemRows = inspectionIds.length
      ? await db.select().from(inspectionItems)
          .where(and(eq(inspectionItems.organizationId, organizationId), inArray(inspectionItems.inspectionId, inspectionIds)))
          .orderBy(desc(inspectionItems.updatedAt))
      : [];

    const recommendations = itemRows.filter((item) => Boolean(item.recommendation));
    const activeRecommendations = recommendations.filter((item) => !['good','ok','pass'].includes(String(item.condition).toLowerCase()));
    const openWorkOrders = workOrderRows.filter((row) => !['complete','completed','cancelled'].includes(row.status));
    const dueSchedules = scheduleRows.filter((row) => {
      if (!row.active) return false;
      if (row.nextDueAt && row.nextDueAt.getTime() <= Date.now()) return true;
      if (row.nextDueMileage != null && vehicle.mileage != null && row.nextDueMileage <= vehicle.mileage) return true;
      if (row.nextDueEngineHours != null && vehicle.engineHours != null && row.nextDueEngineHours <= vehicle.engineHours) return true;
      return false;
    });

    return {
      vehicle,
      account: accountRows[0] ?? null,
      location: locationRows[0] ?? null,
      summary: {
        maintenanceSchedules: scheduleRows.filter((row) => row.active).length,
        dueMaintenance: dueSchedules.length,
        workOrders: workOrderRows.length,
        openWorkOrders: openWorkOrders.length,
        inspections: inspectionRows.length,
        recommendations: activeRecommendations.length,
      },
      maintenanceSchedules: scheduleRows,
      maintenanceHistory: eventRows,
      workOrders: workOrderRows,
      inspections: inspectionRows.map((inspection) => ({
        ...inspection,
        items: itemRows.filter((item) => item.inspectionId === inspection.id),
      })),
      recommendations: activeRecommendations,
    };
  }
}

export const vehicle360Service = new Vehicle360Service();
