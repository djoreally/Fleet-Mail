import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Request } from 'express';
import { getDb } from '../../db/index.js';
import { organizationMemberships, organizations, users } from '../../db/drizzleSchema.js';
import { serverConfig } from '../config.js';

export class FleetAuthError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type FleetRequest = Request & { fleetOrganizationId?: string; fleetMembershipRole?: string };

function database() {
  const value = getDb();
  if (!value) throw new FleetAuthError(503, 'Production database is not configured');
  return value;
}

export function authUser(payload: any) {
  const roots = [payload, payload?.data, payload?.session, payload?.data?.session];
  const users = [
    payload?.user,
    payload?.data?.user,
    payload?.session?.user,
    payload?.data?.session?.user,
    payload?.session?.data?.user,
    payload?.data?.session?.data?.user,
  ];
  const isIdentity = (value: any) => value && typeof value === 'object' && Boolean(
    value.id || value.userId || value.user_id || value.sub
  );
  return users.find(isIdentity) || roots.find(isIdentity) || null;
}

function verifiedBearerClaims(authorization: string) {
  try {
    const token = authorization.slice('Bearer '.length);
    const encoded = token.split('.')[1];
    if (!encoded) return null;
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export async function requireFleetOrganization(req: Request): Promise<string> {
  const fleetReq = req as FleetRequest;
  if (fleetReq.fleetOrganizationId) return fleetReq.fleetOrganizationId;

  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new FleetAuthError(401, 'Authentication required');

  const response = await fetch(`${serverConfig.neonAuthUrl.replace(/\/$/, '')}/get-session`, {
    headers: { authorization, accept: 'application/json' },
  });
  if (!response.ok) throw new FleetAuthError(401, 'Your session is invalid or expired');
  const identity = authUser(await response.json());
  const claims = verifiedBearerClaims(authorization);
  const subject = String(identity?.id || identity?.userId || identity?.user_id || identity?.sub || claims?.sub || '');
  const email = String(identity?.email || identity?.emailAddress || identity?.email_address || identity?.user?.email || claims?.email || `${subject}@fleet.local`);
  if (!subject || !email) throw new FleetAuthError(401, 'Authenticated user identity is incomplete');

  const db = database();
  let [user] = await db.select().from(users).where(eq(users.authSubject, subject)).limit(1);
  if (!user) {
    const displayName = identity?.name || identity?.displayName || identity?.display_name || identity?.user_metadata?.name || email.split('@')[0];
    [user] = await db.insert(users).values({ id: randomUUID(), authSubject: subject, email: email.toLowerCase(), name: String(displayName) }).returning();
  }

  const requested = req.header('x-organization-id');
  let memberships = await db.select({ organizationId: organizationMemberships.organizationId, role: organizationMemberships.role })
    .from(organizationMemberships)
    .where(and(eq(organizationMemberships.userId, user.id), eq(organizationMemberships.status, 'active')));

  if (!memberships.length) {
    const organizationId = randomUUID();
    await db.insert(organizations).values({ id: organizationId, name: `${user.name}'s Fleet`, slug: `fleet-${subject.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()}-${organizationId.slice(0, 6)}` });
    await db.insert(organizationMemberships).values({ id: randomUUID(), organizationId, userId: user.id, role: 'owner', status: 'active' });
    memberships = [{ organizationId, role: 'owner' }];
  }

  const selected = requested ? memberships.find((item) => item.organizationId === requested) : memberships[0];
  if (!selected) throw new FleetAuthError(403, 'You do not have access to this organization');
  fleetReq.fleetOrganizationId = selected.organizationId;
  fleetReq.fleetMembershipRole = selected.role;
  return selected.organizationId;
}

export async function requireFleetRole(req: Request, allowedRoles: string[]) {
  await requireFleetOrganization(req);
  const role = String((req as FleetRequest).fleetMembershipRole || '');
  if (!allowedRoles.includes(role)) throw new FleetAuthError(403, 'Your organization role does not permit this operation');
  return role;
}

export function fleetAuthFailure(res: any, error: unknown) {
  const status = error instanceof FleetAuthError ? error.status : 500;
  return res.status(status).json({ error: error instanceof Error ? error.message : 'Fleet request failed' });
}
