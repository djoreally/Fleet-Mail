import type { NextFunction, Request, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { inboxes } from '../../db/drizzleSchema.js';
import { FleetAuthError, fleetAuthFailure, requireFleetOrganization } from './fleetAuth.js';

function requestedInbox(req: Request) {
  const value = req.query.inbox ?? req.body?.inbox;
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export async function resolveOrganizationAgentMailInbox(req: Request) {
  const organizationId = await requireFleetOrganization(req);
  const db = getDb();
  if (!db) throw new FleetAuthError(503, 'Production database is not configured');

  const rows = await db.select({ email: inboxes.email, externalInboxId: inboxes.externalInboxId })
    .from(inboxes)
    .where(and(eq(inboxes.organizationId, organizationId), eq(inboxes.isActive, true)))
    .limit(20);

  if (!rows.length) throw new FleetAuthError(404, 'No active AgentMail inbox is configured for this organization');

  const requested = requestedInbox(req);
  const selected = requested
    ? rows.find((row) => [row.email, row.externalInboxId].filter(Boolean).some((value) => String(value).toLowerCase() === requested))
    : rows[0];

  if (!selected) throw new FleetAuthError(403, 'The requested AgentMail inbox does not belong to this organization');
  return String(selected.externalInboxId || selected.email);
}

export async function enforceAgentMailInboxScope(req: Request, res: Response, next: NextFunction) {
  try {
    const inbox = await resolveOrganizationAgentMailInbox(req);
    res.locals.agentMailInbox = inbox;
    req.query.inbox = inbox;
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) req.body.inbox = inbox;
    return next();
  } catch (error) {
    return fleetAuthFailure(res, error);
  }
}
