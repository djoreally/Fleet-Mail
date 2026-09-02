import { eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import {
  appointments, authorizations, dispatchAssignments, documents, inspections, invoiceLineItems,
  invoices, locations, payments, serviceLines, technicians,
} from '../../db/drizzleSchema.js';
import type { AgentReadTool } from './agentToolRouter.js';

function termsFrom(input: string) {
  return [...new Set(String(input || '').toLowerCase().replace(/[^a-z0-9@._+-]+/g, ' ').split(/\s+/).filter((value) => value.length >= 3))].slice(0, 8);
}
function matching<T>(rows: T[], terms: string[], limit = 12) {
  if (!terms.length) return rows.slice(0, limit);
  return rows.filter((row) => {
    const haystack = JSON.stringify(row).toLowerCase();
    return terms.some((term) => haystack.includes(term));
  }).slice(0, limit);
}

/**
 * Covers the operational read tools not already served by agentRuntimeSearch.
 * Every query is organization-scoped before any in-memory matching occurs.
 */
export async function searchAgentOperationalContext(organizationId: string, userText: string, selected: AgentReadTool[]) {
  const db = getDb();
  if (!db) return {};
  const wants = (tool: AgentReadTool) => selected.includes(tool);
  const terms = termsFrom(userText);

  const [locationRows, appointmentRows, dispatchRows, inspectionRows, authorizationRows, serviceLineRows, invoiceRows, paymentRows, documentRows] = await Promise.all([
    wants('locations.search') ? db.select().from(locations).where(eq(locations.organizationId, organizationId)).limit(40) : [],
    wants('schedule.search') ? db.select().from(appointments).where(eq(appointments.organizationId, organizationId)).limit(40) : [],
    wants('dispatch.search') ? db.select({
      id: dispatchAssignments.id, workOrderId: dispatchAssignments.workOrderId, appointmentId: dispatchAssignments.appointmentId,
      technicianId: dispatchAssignments.technicianId, technicianName: technicians.name, resourceId: dispatchAssignments.resourceId,
      status: dispatchAssignments.status, startsAt: dispatchAssignments.startsAt, arrivedAt: dispatchAssignments.arrivedAt,
      completedAt: dispatchAssignments.completedAt,
    }).from(dispatchAssignments).leftJoin(technicians, eq(technicians.id, dispatchAssignments.technicianId))
      .where(eq(dispatchAssignments.organizationId, organizationId)).limit(40) : [],
    wants('inspections.search') ? db.select().from(inspections).where(eq(inspections.organizationId, organizationId)).limit(40) : [],
    wants('authorizations.search') ? db.select().from(authorizations).where(eq(authorizations.organizationId, organizationId)).limit(40) : [],
    wants('financials.search') ? db.select().from(serviceLines).where(eq(serviceLines.organizationId, organizationId)).limit(60) : [],
    wants('invoices.search') || wants('financials.search') ? db.select().from(invoices).where(eq(invoices.organizationId, organizationId)).limit(40) : [],
    wants('payments.search') || wants('financials.search') ? db.select().from(payments).where(eq(payments.organizationId, organizationId)).limit(40) : [],
    wants('documents.search') ? db.select({
      id: documents.id, customerId: documents.customerId, vehicleId: documents.vehicleId, workOrderId: documents.workOrderId,
      kind: documents.kind, name: documents.name, mimeType: documents.mimeType, sizeBytes: documents.sizeBytes, createdAt: documents.createdAt,
    }).from(documents).where(eq(documents.organizationId, organizationId)).limit(40) : [],
  ]);

  return {
    locations: matching(locationRows, terms),
    schedule: matching(appointmentRows, terms),
    dispatch: matching(dispatchRows, terms),
    inspections: matching(inspectionRows, terms),
    authorizations: matching(authorizationRows, terms),
    financials: matching(serviceLineRows, terms),
    invoices: matching(invoiceRows, terms),
    payments: matching(paymentRows, terms),
    documents: matching(documentRows, terms),
  };
}
