import { and, eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { customers, locations, technicians, vehicles, workOrders } from '../../db/drizzleSchema.js';
import { technicianVehicleSnapshot } from './vehicleSpecifications.js';

function database() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL is not configured');
  return db;
}

export async function getTechnicianWorkOrderContext(organizationId: string, workOrderId: string) {
  const db = database();
  const [row] = await db.select({
    workOrderId: workOrders.id,
    number: workOrders.number,
    status: workOrders.status,
    priority: workOrders.priority,
    scheduledAt: workOrders.scheduledAt,
    odometer: workOrders.odometer,
    engineHours: workOrders.engineHours,
    purchaseOrderNumber: workOrders.purchaseOrderNumber,
    requestedServices: workOrders.requestedServices,
    customerNotes: workOrders.customerNotes,
    technicianNotes: workOrders.technicianNotes,
    complaint: workOrders.complaint,
    diagnosis: workOrders.diagnosis,
    vehicleId: vehicles.id,
    unitNumber: vehicles.unitNumber,
    vin: vehicles.vin,
    year: vehicles.year,
    make: vehicles.make,
    model: vehicles.model,
    trim: vehicles.trim,
    engine: vehicles.engine,
    fuelType: vehicles.fuelType,
    mileage: vehicles.mileage,
    vehicleEngineHours: vehicles.engineHours,
    specifications: vehicles.specifications,
    customerId: customers.id,
    customerName: customers.name,
    locationId: locations.id,
    locationName: locations.name,
    address1: locations.address1,
    address2: locations.address2,
    city: locations.city,
    region: locations.region,
    postalCode: locations.postalCode,
    technicianId: technicians.id,
    technicianName: technicians.name,
  }).from(workOrders)
    .innerJoin(vehicles, and(eq(vehicles.id, workOrders.vehicleId), eq(vehicles.organizationId, organizationId)))
    .leftJoin(customers, and(eq(customers.id, workOrders.customerId), eq(customers.organizationId, organizationId)))
    .leftJoin(locations, and(eq(locations.id, workOrders.locationId), eq(locations.organizationId, organizationId)))
    .leftJoin(technicians, and(eq(technicians.id, workOrders.technicianId), eq(technicians.organizationId, organizationId)))
    .where(and(eq(workOrders.organizationId, organizationId), eq(workOrders.id, workOrderId)))
    .limit(1);

  if (!row) throw new Error('Work order was not found');

  return {
    workOrder: {
      id: row.workOrderId,
      number: row.number,
      status: row.status,
      priority: row.priority,
      scheduledAt: row.scheduledAt,
      odometer: row.odometer,
      engineHours: row.engineHours,
      purchaseOrderNumber: row.purchaseOrderNumber,
      requestedServices: row.requestedServices,
      customerNotes: row.customerNotes,
      technicianNotes: row.technicianNotes,
      complaint: row.complaint,
      diagnosis: row.diagnosis,
    },
    vehicle: technicianVehicleSnapshot({
      id: row.vehicleId,
      unitNumber: row.unitNumber,
      vin: row.vin,
      year: row.year,
      make: row.make,
      model: row.model,
      trim: row.trim,
      engine: row.engine,
      fuelType: row.fuelType,
      mileage: row.mileage,
      engineHours: row.vehicleEngineHours,
      specifications: row.specifications,
    }),
    customer: row.customerId ? { id: row.customerId, name: row.customerName } : null,
    location: row.locationId ? {
      id: row.locationId,
      name: row.locationName,
      address1: row.address1,
      address2: row.address2,
      city: row.city,
      region: row.region,
      postalCode: row.postalCode,
    } : null,
    technician: row.technicianId ? { id: row.technicianId, name: row.technicianName } : null,
  };
}
