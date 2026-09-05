import { desc, eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { auditEvents } from '../../db/drizzleSchema.js';

function terms(input: string) {
  return [...new Set(String(input || '').toLowerCase().replace(/[^a-z0-9@._+-]+/g, ' ').split(/\s+/).filter((value) => value.length >= 3))].slice(0, 10);
}

export async function searchFleetChangeLedger(organizationId: string, query = '') {
  const db = getDb();
  if (!db) throw new Error('Production database is not configured');
  const rows = await db.select({
    id: auditEvents.id,
    actorUserId: auditEvents.actorUserId,
    eventType: auditEvents.eventType,
    entityType: auditEvents.entityType,
    entityId: auditEvents.entityId,
    requestId: auditEvents.requestId,
    payload: auditEvents.payload,
    occurredAt: auditEvents.occurredAt,
  }).from(auditEvents)
    .where(eq(auditEvents.organizationId, organizationId))
    .orderBy(desc(auditEvents.occurredAt))
    .limit(250);

  const queryTerms = terms(query);
  const matching = queryTerms.length
    ? rows.filter((row) => {
        const haystack = JSON.stringify(row).toLowerCase();
        return queryTerms.some((term) => haystack.includes(term));
      })
    : rows;

  return {
    query,
    queryTerms,
    events: matching.slice(0, 50),
    scanned: rows.length,
    source: 'audit_events',
  };
}
