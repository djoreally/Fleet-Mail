import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Request } from 'express';
import { getDb } from '../../db/index.js';
import { organizationMemberships, organizations, users } from '../../db/drizzleSchema.js';
import { serverConfig } from '../config.js';

export class FleetAuthError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function database() {
  const value = getDb();
  if (!value) throw new FleetAuthError(503, 'Production database is not configured');
  return value;
}

function authUser(payload: any) {
  const root = payload?.data || payload;
  return root?.user || root?.session?.user || root?.session?.data?.user || payload?.user || null;
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
  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new FleetAuthError(401, 'Authentication required');

  const response = await fetch(`${serverConfig.neonAuthUrl.replace(/\/$/, '')}/get-session`, {
    headers: { authorization, accept: 'application/json' },
  });
  if (!response.ok) throw new FleetAuthError(401, 'Your session is invalid or expired');
  const identity = authUser(await response.json());
  // The Auth service has already verified this bearer token. Claims are used
  // only to fill identity fields omitted by some Neon Auth response versions.
  const claims = verifiedBearerClaims(authorization);
  const subject = String(identity?.id || identity?.userId || claims?.sub || '');
  const email = String(identity?.email || identity?.emailAddress || claims?.email || `${subject}@fleet.local`);
  if (!subject || !email) throw new FleetAuthError(401, 'Authenticated user identity is incomplete');

  const db = database();
  let [user] = await db.select().from(users).where(eq(users.authSubject, subject)).limit(1);
  if (!user) {
    [user] = await db.insert(users).values({ id: randomUUID(), authSubject: subject, email: email.toLowerCase(), name: String(identity.name || email.split('@')[0]) }).returning();
  }

  const requested = req.header('x-organization-id');
  let memberships = await db.select({ organizationId: organizationMemberships.organizationId })
    .from(organizationMemberships)
    .where(and(eq(organizationMemberships.userId, user.id), eq(organizationMemberships.status, 'active')));

  if (!memberships.length) {
    const organizationId = randomUUID();
    await db.insert(organizations).values({ id: organizationId, name: `${user.name}'s Fleet`, slug: `fleet-${subject.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()}-${organizationId.slice(0, 6)}` });
    await db.insert(organizationMemberships).values({ id: randomUUID(), organizationId, userId: user.id, role: 'owner', status: 'active' });
    memberships = [{ organizationId }];
  }

  if (requested && !memberships.some((item) => item.organizationId === requested)) throw new FleetAuthError(403, 'You do not have access to this organization');
  return requested || memberships[0].organizationId;
}

export function fleetAuthFailure(res: any, error: unknown) {
  const status = error instanceof FleetAuthError ? error.status : 500;
  return res.status(status).json({ error: error instanceof Error ? error.message : 'Fleet request failed' });
}
