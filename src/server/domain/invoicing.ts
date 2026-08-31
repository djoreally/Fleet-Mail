import { ActorContext, DomainResult, FleetDomainError, Invoice, WorkOrder, assertOrganization, audit } from './fleet';

export function invoiceFromWorkOrder(workOrder: WorkOrder, invoiceId: string, taxRate: number, context: ActorContext): DomainResult<Invoice> {
  assertOrganization(context.organizationId, workOrder.organizationId);
  if (workOrder.status !== 'completed') throw new FleetDomainError('WORK_ORDER_NOT_COMPLETED', 'Only completed work can be invoiced');
  if (taxRate < 0) throw new FleetDomainError('INVALID_TAX_RATE', 'Tax rate cannot be negative');
  const lines = workOrder.lines.filter((line) => line.authorized).map((line) => ({ ...line, workOrderLineId: line.id, subtotalCents: line.quantity * line.unitPriceCents }));
  const subtotalCents = lines.reduce((sum, line) => sum + line.subtotalCents, 0);
  const taxCents = Math.round(subtotalCents * taxRate);
  const totalCents = subtotalCents + taxCents;
  const value: Invoice = { organizationId: workOrder.organizationId, id: invoiceId, fleetCustomerId: workOrder.fleetCustomerId, workOrderId: workOrder.id,
    status: 'draft', lines, subtotalCents, taxCents, totalCents, paidCents: 0, balanceCents: totalCents, purchaseOrderNumber: workOrder.purchaseOrderNumber };
  return { value, events: [audit(context, 'invoice', invoiceId, 'invoice.created', { workOrderId: workOrder.id, totalCents })] };
}

export function applyPayment(invoice: Invoice, amountCents: number, context: ActorContext): DomainResult<Invoice> {
  assertOrganization(context.organizationId, invoice.organizationId);
  if (!['issued', 'partially_paid'].includes(invoice.status)) throw new FleetDomainError('INVOICE_NOT_PAYABLE', 'Invoice must be issued before payment');
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > invoice.balanceCents) throw new FleetDomainError('INVALID_PAYMENT', 'Payment must be positive and no greater than the balance');
  const paidCents = invoice.paidCents + amountCents, balanceCents = invoice.totalCents - paidCents;
  const value: Invoice = { ...invoice, paidCents, balanceCents, status: balanceCents === 0 ? 'paid' : 'partially_paid' };
  return { value, events: [audit(context, 'invoice', invoice.id, 'invoice.payment_applied', { amountCents, balanceCents })] };
}
