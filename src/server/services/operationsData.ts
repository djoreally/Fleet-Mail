import { randomUUID } from 'node:crypto';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { contacts, customers, inventory, parts, vehicles } from '../../db/drizzleSchema.js';

export type CustomerInput = {
  name: string;
  accountNumber?: string | null;
  billingEmail?: string | null;
  phone?: string | null;
  status?: string;
  notes?: string | null;
};

export type PartInput = {
  sku: string;
  name: string;
  description?: string | null;
  unitCost?: number | null;
  unitPrice?: number | null;
  quantity?: number;
  reorderPoint?: number;
  locationId?: string | null;
};

const clean = (value: unknown, field: string, max = 200) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  return value.trim().slice(0, max);
};
const optional = (value: unknown, max = 500) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
const finite = (value: unknown, fallback = 0) => {
  const result = Number(value ?? fallback);
  if (!Number.isFinite(result) || result < 0) throw new Error('Numeric values must be zero or greater');
  return result;
};

export function normalizeCustomerInput(input: Record<string, unknown>): CustomerInput {
  return {
    name: clean(input.name, 'Customer name'),
    accountNumber: optional(input.accountNumber, 80),
    billingEmail: optional(input.billingEmail, 320),
    phone: optional(input.phone, 50),
    status: optional(input.status, 40) ?? 'active',
    notes: optional(input.notes, 2000),
  };
}

export function normalizePartInput(input: Record<string, unknown>): PartInput {
  return {
    sku: clean(input.sku, 'SKU', 80).toUpperCase(),
    name: clean(input.name, 'Part name'),
    description: optional(input.description, 1000),
    unitCost: input.unitCost == null ? null : finite(input.unitCost),
    unitPrice: input.unitPrice == null ? null : finite(input.unitPrice),
    quantity: finite(input.quantity),
    reorderPoint: finite(input.reorderPoint),
    locationId: optional(input.locationId, 100),
  };
}

function database() {
  const db = getDb();
  if (!db) throw new Error('Database is not configured');
  return db;
}

export class OperationsDataService {
  async listCustomers(organizationId: string, search = '') {
    const db = database();
    const query = search.trim().slice(0, 100);
    const where = and(
      eq(customers.organizationId, organizationId),
      query ? or(ilike(customers.name, `%${query}%`), ilike(customers.billingEmail, `%${query}%`)) : undefined,
    );
    return db.select({
      id: customers.id, name: customers.name, accountNumber: customers.accountNumber,
      billingEmail: customers.billingEmail, phone: customers.phone, status: customers.status,
      notes: customers.notes, updatedAt: customers.updatedAt,
      vehicleCount: sql<number>`count(distinct ${vehicles.id})::int`,
      primaryContact: sql<string | null>`max(${contacts.name}) filter (where ${contacts.isPrimary} = true)`,
      contactEmail: sql<string | null>`max(${contacts.email}) filter (where ${contacts.isPrimary} = true)`,
      spend30Days: sql<string>`(select coalesce(sum(i.total), 0)::text from invoices i where i.organization_id = ${organizationId} and i.customer_id = ${customers.id} and i.created_at >= now() - interval '30 days' and i.status not in ('void','draft'))`,
    }).from(customers)
      .leftJoin(vehicles, and(eq(vehicles.customerId, customers.id), eq(vehicles.organizationId, organizationId)))
      .leftJoin(contacts, and(eq(contacts.customerId, customers.id), eq(contacts.organizationId, organizationId)))
      .where(where).groupBy(customers.id).orderBy(desc(customers.updatedAt)).limit(200);
  }

  async createCustomer(organizationId: string, raw: Record<string, unknown>) {
    const value = normalizeCustomerInput(raw);
    const [created] = await database().insert(customers).values({ id: randomUUID(), organizationId, ...value }).returning();
    return created;
  }

  async updateCustomer(organizationId: string, id: string, raw: Record<string, unknown>) {
    const value = normalizeCustomerInput(raw);
    const [updated] = await database().update(customers).set({ ...value, updatedAt: new Date() })
      .where(and(eq(customers.organizationId, organizationId), eq(customers.id, id))).returning();
    if (!updated) throw new Error('Customer not found');
    return updated;
  }

  async deleteCustomer(organizationId: string, id: string) {
    const deleted = await database().delete(customers).where(and(eq(customers.organizationId, organizationId), eq(customers.id, id))).returning();
    return deleted.length > 0;
  }

  async listParts(organizationId: string, search = '') {
    const query = search.trim().slice(0, 100);
    return database().select({
      id: parts.id, sku: parts.sku, name: parts.name, description: parts.description,
      unitCost: parts.unitCost, unitPrice: parts.unitPrice, updatedAt: parts.updatedAt,
      quantity: sql<string>`coalesce(sum(${inventory.quantity}), 0)::text`,
      reorderPoint: sql<string>`coalesce(sum(${inventory.reorderPoint}), 0)::text`,
    }).from(parts).leftJoin(inventory, and(eq(inventory.partId, parts.id), eq(inventory.organizationId, organizationId)))
      .where(and(eq(parts.organizationId, organizationId), query ? or(ilike(parts.sku, `%${query}%`), ilike(parts.name, `%${query}%`)) : undefined))
      .groupBy(parts.id).orderBy(desc(parts.updatedAt)).limit(300);
  }

  async createPart(organizationId: string, raw: Record<string, unknown>) {
    const value = normalizePartInput(raw);
    const partId = randomUUID();
    const [created] = await database().insert(parts).values({
      id: partId, organizationId, sku: value.sku, name: value.name, description: value.description,
      unitCost: value.unitCost?.toFixed(2), unitPrice: value.unitPrice?.toFixed(2),
    }).returning();
    await database().insert(inventory).values({
      id: randomUUID(), organizationId, partId, locationId: value.locationId,
      quantity: String(value.quantity), reorderPoint: String(value.reorderPoint),
    });
    return created;
  }

  async updatePart(organizationId: string, id: string, raw: Record<string, unknown>) {
    const value = normalizePartInput(raw);
    const [updated] = await database().update(parts).set({
      sku: value.sku, name: value.name, description: value.description,
      unitCost: value.unitCost?.toFixed(2), unitPrice: value.unitPrice?.toFixed(2), updatedAt: new Date(),
    }).where(and(eq(parts.organizationId, organizationId), eq(parts.id, id))).returning();
    if (!updated) throw new Error('Part not found');
    return updated;
  }

  async adjustInventory(organizationId: string, partId: string, quantity: unknown, reorderPoint: unknown) {
    const db = database();
    const [existing] = await db.select({ id: inventory.id }).from(inventory)
      .where(and(eq(inventory.organizationId, organizationId), eq(inventory.partId, partId))).limit(1);
    const values = { quantity: String(finite(quantity)), reorderPoint: String(finite(reorderPoint)), updatedAt: new Date() };
    if (existing) {
      const [updated] = await db.update(inventory).set(values).where(and(eq(inventory.organizationId, organizationId), eq(inventory.id, existing.id))).returning();
      return updated;
    }
    const [created] = await db.insert(inventory).values({ id: randomUUID(), organizationId, partId, ...values }).returning();
    return created;
  }

  async deletePart(organizationId: string, id: string) {
    const deleted = await database().delete(parts).where(and(eq(parts.organizationId, organizationId), eq(parts.id, id))).returning();
    return deleted.length > 0;
  }
}

export const operationsDataService = new OperationsDataService();
