import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/index.js';
import { customers, documents, estimates, fluidUsage, invoiceLineItems, invoices, partUsage, parts, payments, serviceLines, workOrders } from '../../db/drizzleSchema.js';

export class FinancialDocumentsError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function db() {
  const value = getDb();
  if (!value) throw new FinancialDocumentsError(503, 'Database is not configured');
  return value;
}

export async function financialOverview(organizationId: string) {
  const database = db();
  const invoiceRows = await database.select({
    id: invoices.id, number: invoices.number, status: invoices.status, total: invoices.total,
    balanceDue: invoices.balanceDue, dueAt: invoices.dueAt, createdAt: invoices.createdAt,
    customer: customers.name, workOrder: workOrders.number,
  }).from(invoices)
    .leftJoin(customers, and(eq(customers.id, invoices.customerId), eq(customers.organizationId, organizationId)))
    .leftJoin(workOrders, and(eq(workOrders.id, invoices.workOrderId), eq(workOrders.organizationId, organizationId)))
    .where(eq(invoices.organizationId, organizationId)).orderBy(desc(invoices.createdAt));

  const paymentRows = await database.select({
    id: payments.id, invoiceId: payments.invoiceId, invoiceNumber: invoices.number, customer: customers.name,
    amount: payments.amount, status: payments.status, provider: payments.provider, paidAt: payments.paidAt, createdAt: payments.createdAt,
  }).from(payments)
    .innerJoin(invoices, and(eq(invoices.id, payments.invoiceId), eq(invoices.organizationId, organizationId)))
    .leftJoin(customers, and(eq(customers.id, invoices.customerId), eq(customers.organizationId, organizationId)))
    .where(eq(payments.organizationId, organizationId)).orderBy(desc(payments.createdAt));

  const estimateRows = await database.select({
    id: estimates.id, number: estimates.number, status: estimates.status, total: estimates.total,
    customer: customers.name, workOrder: workOrders.number, createdAt: estimates.createdAt,
  }).from(estimates)
    .leftJoin(customers, and(eq(customers.id, estimates.customerId), eq(customers.organizationId, organizationId)))
    .leftJoin(workOrders, and(eq(workOrders.id, estimates.workOrderId), eq(workOrders.organizationId, organizationId)))
    .where(eq(estimates.organizationId, organizationId)).orderBy(desc(estimates.createdAt));

  const now = new Date();
  const open = invoiceRows.filter(row => !['paid', 'void'].includes(row.status));
  const overdue = open.filter(row => row.dueAt && row.dueAt < now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const collected = paymentRows.filter(row => row.status === 'paid' && row.paidAt && row.paidAt >= monthStart)
    .reduce((sum, row) => sum + Number(row.amount), 0);
  return {
    invoices: invoiceRows, payments: paymentRows, estimates: estimateRows,
    metrics: {
      openReceivables: open.reduce((sum, row) => sum + Number(row.balanceDue), 0), openInvoiceCount: open.length,
      overdueReceivables: overdue.reduce((sum, row) => sum + Number(row.balanceDue), 0), overdueInvoiceCount: overdue.length,
      collectedThisMonth: collected,
    },
  };
}

type InvoiceInput = { customerId?: string; workOrderId?: string | null; number?: string; status?: string; subtotal?: number; tax?: number; dueAt?: string | null; purchaseOrderNumber?: string | null };
export async function createInvoice(organizationId: string, input: InvoiceInput) {
  if (!input.customerId || !input.number) throw new FinancialDocumentsError(400, 'customerId and number are required');
  const [customer] = await db().select({ id: customers.id }).from(customers).where(and(eq(customers.organizationId, organizationId), eq(customers.id, input.customerId))).limit(1);
  if (!customer) throw new FinancialDocumentsError(400, 'Customer is not in the active organization');
  if (input.workOrderId) {
    const [workOrder] = await db().select({ id: workOrders.id }).from(workOrders).where(and(eq(workOrders.organizationId, organizationId), eq(workOrders.id, input.workOrderId))).limit(1);
    if (!workOrder) throw new FinancialDocumentsError(400, 'Work order is not in the active organization');
  }
  const database = db();
  const serviceRows = input.workOrderId ? await database.select().from(serviceLines).where(and(eq(serviceLines.organizationId, organizationId), eq(serviceLines.workOrderId, input.workOrderId))) : [];
  const partRows = input.workOrderId ? await database.select({ usage: partUsage, name: parts.name, sku: parts.sku, defaultPrice: parts.unitPrice }).from(partUsage).innerJoin(parts, eq(parts.id, partUsage.partId)).where(and(eq(partUsage.organizationId, organizationId), eq(partUsage.workOrderId, input.workOrderId))) : [];
  const fluidRows = input.workOrderId ? await database.select().from(fluidUsage).where(and(eq(fluidUsage.organizationId, organizationId), eq(fluidUsage.workOrderId, input.workOrderId))) : [];
  const lines = [
    ...serviceRows.map(item => ({ kind: item.kind, description: item.description, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) })),
    ...partRows.map(({ usage, name, sku, defaultPrice }) => ({ kind: 'part', description: `${sku} · ${name}`, quantity: Number(usage.quantity), unitPrice: Number(usage.sellPrice ?? defaultPrice ?? 0) })),
    ...fluidRows.map(item => ({ kind: 'fluid', description: [item.name, item.viscosity, item.specification].filter(Boolean).join(' · '), quantity: Number(item.quantity), unitPrice: Number(item.sellPrice ?? 0) })),
  ];
  const derivedSubtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const subtotal = input.subtotal == null ? derivedSubtotal : Number(input.subtotal);
  const tax = Number(input.tax || 0), total = subtotal + tax;
  const [row] = await database.insert(invoices).values({ organizationId, customerId: customer.id, workOrderId: input.workOrderId || null, number: input.number,
    status: input.status || 'draft', subtotal: String(subtotal), tax: String(tax), total: String(total), balanceDue: String(total),
    dueAt: input.dueAt ? new Date(input.dueAt) : null, purchaseOrderNumber: input.purchaseOrderNumber || null }).returning();
  if (lines.length) await database.insert(invoiceLineItems).values(lines.map((line, position) => ({ id: randomUUID(), organizationId, invoiceId: row.id, kind: line.kind, description: line.description, quantity: String(line.quantity), unitPrice: String(line.unitPrice), lineTotal: String(line.quantity * line.unitPrice), position })));
  return row;
}

type DocumentInput = { name?: string; kind?: string; storageKey?: string; mimeType?: string | null; sizeBytes?: number | null; customerId?: string | null; vehicleId?: string | null; workOrderId?: string | null };
export async function createDocument(organizationId: string, input: DocumentInput) {
  if (!input.name || !input.kind || !input.storageKey) throw new FinancialDocumentsError(400, 'name, kind, and storageKey are required');
  if (/^javascript:/i.test(input.storageKey.trim())) throw new FinancialDocumentsError(400, 'Invalid storage key');
  if (input.customerId) {
    const [customer] = await db().select({ id: customers.id }).from(customers).where(and(eq(customers.organizationId, organizationId), eq(customers.id, input.customerId))).limit(1);
    if (!customer) throw new FinancialDocumentsError(400, 'Customer is not in the active organization');
  }
  if (input.workOrderId) {
    const [workOrder] = await db().select({ id: workOrders.id }).from(workOrders).where(and(eq(workOrders.organizationId, organizationId), eq(workOrders.id, input.workOrderId))).limit(1);
    if (!workOrder) throw new FinancialDocumentsError(400, 'Work order is not in the active organization');
  }
  const [row] = await db().insert(documents).values({ organizationId, name: input.name, kind: input.kind, storageKey: input.storageKey,
    mimeType: input.mimeType || null, sizeBytes: input.sizeBytes || null, customerId: input.customerId || null,
    vehicleId: input.vehicleId || null, workOrderId: input.workOrderId || null }).returning();
  return row;
}

export async function listDocuments(organizationId: string) {
  return db().select({ id: documents.id, name: documents.name, kind: documents.kind, storageKey: documents.storageKey,
    mimeType: documents.mimeType, sizeBytes: documents.sizeBytes, customer: customers.name, workOrder: workOrders.number,
    customerId: documents.customerId, vehicleId: documents.vehicleId, workOrderId: documents.workOrderId, createdAt: documents.createdAt,
  }).from(documents)
    .leftJoin(customers, and(eq(customers.id, documents.customerId), eq(customers.organizationId, organizationId)))
    .leftJoin(workOrders, and(eq(workOrders.id, documents.workOrderId), eq(workOrders.organizationId, organizationId)))
    .where(eq(documents.organizationId, organizationId)).orderBy(desc(documents.createdAt));
}

export async function deleteDocument(organizationId: string, id: string) {
  const [row] = await db().delete(documents).where(and(eq(documents.organizationId, organizationId), eq(documents.id, id))).returning();
  if (!row) throw new FinancialDocumentsError(404, 'Document not found');
  return row;
}
