import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { contacts, customers, emailThreads, invoices, locations, vehicles, workOrders } from '../../db/drizzleSchema.js';

function database() {
  const db = getDb();
  if (!db) throw new Error('Database is not configured');
  return db;
}

const OPEN_WORK_ORDER_STATUSES = new Set(['draft','scheduled','assigned','en_route','arrived','in_progress','review','authorization_pending','authorized']);

export class FleetAccount360Service {
  async get(organizationId: string, customerId: string) {
    const db = database();
    const [account] = await db.select().from(customers)
      .where(and(eq(customers.organizationId, organizationId), eq(customers.id, customerId))).limit(1);
    if (!account) throw new Error('Fleet account not found');

    const [contactRows, locationRows, vehicleRows, workOrderRows, invoiceRows, threadRows] = await Promise.all([
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
        .orderBy(desc(workOrders.updatedAt)).limit(100),
      db.select().from(invoices)
        .where(and(eq(invoices.organizationId, organizationId), eq(invoices.customerId, customerId)))
        .orderBy(desc(invoices.createdAt)).limit(100),
      db.select({ id: emailThreads.id, subject: emailThreads.subject, workOrderId: emailThreads.workOrderId, lastMessageAt: emailThreads.lastMessageAt, updatedAt: emailThreads.updatedAt })
        .from(emailThreads)
        .where(and(eq(emailThreads.organizationId, organizationId), eq(emailThreads.customerId, customerId)))
        .orderBy(desc(emailThreads.lastMessageAt)).limit(50),
    ]);

    const openWorkOrders = workOrderRows.filter((row) => OPEN_WORK_ORDER_STATUSES.has(row.status));
    const outstandingBalance = invoiceRows.reduce((sum, row) => sum + Number(row.balanceDue || 0), 0);
    const lifetimeInvoiced = invoiceRows
      .filter((row) => !['draft','void'].includes(row.status))
      .reduce((sum, row) => sum + Number(row.total || 0), 0);

    return {
      account,
      summary: {
        contacts: contactRows.length,
        locations: locationRows.length,
        vehicles: vehicleRows.length,
        activeVehicles: vehicleRows.filter((row) => row.status === 'active').length,
        openWorkOrders: openWorkOrders.length,
        outstandingBalance: outstandingBalance.toFixed(2),
        lifetimeInvoiced: lifetimeInvoiced.toFixed(2),
        communicationThreads: threadRows.length,
      },
      contacts: contactRows,
      locations: locationRows,
      vehicles: vehicleRows,
      workOrders: workOrderRows,
      invoices: invoiceRows,
      communications: threadRows,
    };
  }
}

export const fleetAccount360Service = new FleetAccount360Service();
