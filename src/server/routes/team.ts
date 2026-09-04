import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import { Router } from 'express';
import { fleetAuthFailure, getFleetAccessContext, requireFleetOrganization, requireFleetPermission } from '../services/fleetAuth.js';
import { getAgentMailClient } from '../services/agentmail.js';
import { resolveOrganizationAgentMailInbox } from '../services/agentMailTenantBoundary.js';
import { normalizeFleetRole, type FleetRole } from '../services/rbac.js';

export const teamRouter = Router();
const INVITABLE_ROLES = new Set<FleetRole>(['admin', 'dispatcher', 'technician', 'viewer']);
const sevenDays = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

function pool() {
  const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL or NEON_DATABASE_URL is required');
  return new Pool({ connectionString });
}

function appBaseUrl(req: any) {
  const explicit = process.env.PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  return `${proto}://${req.get('host')}`;
}

async function sendInvite(req: any, email: string, role: FleetRole, id: string, token: string) {
  const client = getAgentMailClient() as any;
  if (!client) return false;
  const inbox = await resolveOrganizationAgentMailInbox(req);
  const link = `${appBaseUrl(req)}/sign-up?invite_id=${encodeURIComponent(id)}&invite_token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  await client.inboxes.messages.send(inbox, {
    to: email,
    subject: `You're invited to Fleet OS as ${role}`,
    text: `You've been invited to join a Fleet OS workspace as ${role}. Accept your invitation here: ${link}\n\nThis invitation expires in 7 days.`,
  });
  return true;
}

teamRouter.get('/', async (req, res) => {
  let db: Pool | null = null;
  try {
    const organizationId = await requireFleetOrganization(req);
    await requireFleetPermission(req, 'team.view');
    const access = await getFleetAccessContext(req);
    db = pool();
    const [members, invitations] = await Promise.all([
      db.query(`SELECT m.id, m.user_id AS "userId", m.role, m.status, m.created_at AS "createdAt", u.name, u.email, u.avatar_url AS "avatarUrl"
        FROM organization_memberships m JOIN users u ON u.id = m.user_id
        WHERE m.organization_id = $1 ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'dispatcher' THEN 2 WHEN 'technician' THEN 3 ELSE 4 END, u.name`, [organizationId]),
      db.query(`SELECT id, email, role, status, expires_at AS "expiresAt", delivery_status AS "deliveryStatus", created_at AS "createdAt"
        FROM organization_invitations WHERE organization_id = $1 AND status = 'pending' ORDER BY created_at DESC`, [organizationId]),
    ]);
    return res.json({ role: access.role, permissions: access.permissions, canManage: access.permissions.includes('team.manage'), members: members.rows, invitations: invitations.rows });
  } catch (error) { return fleetAuthFailure(res, error); }
  finally { if (db) await db.end(); }
});

teamRouter.post('/invitations', async (req, res) => {
  let db: Pool | null = null;
  try {
    const organizationId = await requireFleetOrganization(req);
    await requireFleetPermission(req, 'team.manage');
    const access = await getFleetAccessContext(req);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = normalizeFleetRole(req.body?.role);
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'A valid email is required' });
    if (!INVITABLE_ROLES.has(role)) return res.status(400).json({ error: 'Role must be admin, dispatcher, technician, or viewer' });
    db = pool();
    const existing = await db.query(`SELECT 1 FROM organization_memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND lower(u.email)=lower($2) AND m.status='active' LIMIT 1`, [organizationId, email]);
    if (existing.rowCount) return res.status(409).json({ error: 'This user is already an active member of the workspace' });

    await db.query(`UPDATE organization_invitations SET status='revoked', updated_at=now() WHERE organization_id=$1 AND lower(email)=lower($2) AND status='pending'`, [organizationId, email]);
    const id = randomUUID();
    const token = randomBytes(32).toString('base64url');
    const expiresAt = sevenDays();
    await db.query(`INSERT INTO organization_invitations(id,organization_id,email,role,token_hash,invited_by_user_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)`, [id, organizationId, email, role, tokenHash(token), access.userId, expiresAt]);
    let sent = false;
    try { sent = await sendInvite(req, email, role, id, token); } catch { sent = false; }
    await db.query(`UPDATE organization_invitations SET delivery_status=$2, updated_at=now() WHERE id=$1`, [id, sent ? 'sent' : 'failed']);
    return res.status(201).json({ invitation: { id, email, role, status: 'pending', expiresAt, deliveryStatus: sent ? 'sent' : 'failed' }, sent });
  } catch (error) { return fleetAuthFailure(res, error); }
  finally { if (db) await db.end(); }
});

teamRouter.post('/invitations/:id/resend', async (req, res) => {
  let db: Pool | null = null;
  try {
    const organizationId = await requireFleetOrganization(req);
    await requireFleetPermission(req, 'team.manage');
    db = pool();
    const found = await db.query(`SELECT id,email,role FROM organization_invitations WHERE id=$1 AND organization_id=$2 AND status='pending' LIMIT 1`, [req.params.id, organizationId]);
    const invitation = found.rows[0];
    if (!invitation) return res.status(404).json({ error: 'Pending invitation not found' });
    const token = randomBytes(32).toString('base64url');
    const expiresAt = sevenDays();
    await db.query(`UPDATE organization_invitations SET token_hash=$2, expires_at=$3, delivery_status='pending', updated_at=now() WHERE id=$1`, [invitation.id, tokenHash(token), expiresAt]);
    let sent = false;
    try { sent = await sendInvite(req, invitation.email, normalizeFleetRole(invitation.role), invitation.id, token); } catch { sent = false; }
    await db.query(`UPDATE organization_invitations SET delivery_status=$2, updated_at=now() WHERE id=$1`, [invitation.id, sent ? 'sent' : 'failed']);
    return res.json({ sent, expiresAt, deliveryStatus: sent ? 'sent' : 'failed' });
  } catch (error) { return fleetAuthFailure(res, error); }
  finally { if (db) await db.end(); }
});

teamRouter.delete('/invitations/:id', async (req, res) => {
  let db: Pool | null = null;
  try {
    const organizationId = await requireFleetOrganization(req);
    await requireFleetPermission(req, 'team.manage');
    db = pool();
    const result = await db.query(`UPDATE organization_invitations SET status='revoked', updated_at=now() WHERE id=$1 AND organization_id=$2 AND status='pending' RETURNING id`, [req.params.id, organizationId]);
    if (!result.rowCount) return res.status(404).json({ error: 'Pending invitation not found' });
    return res.json({ revoked: true });
  } catch (error) { return fleetAuthFailure(res, error); }
  finally { if (db) await db.end(); }
});

teamRouter.patch('/members/:membershipId', async (req, res) => {
  let db: Pool | null = null;
  try {
    const organizationId = await requireFleetOrganization(req);
    await requireFleetPermission(req, 'team.manage');
    const role = req.body?.role === undefined ? null : normalizeFleetRole(req.body.role);
    const status = req.body?.status === undefined ? null : String(req.body.status);
    if (role && !INVITABLE_ROLES.has(role)) return res.status(400).json({ error: 'Owner role cannot be assigned here' });
    if (status && !['active','inactive'].includes(status)) return res.status(400).json({ error: 'Status must be active or inactive' });
    db = pool();
    const current = await db.query(`SELECT m.id,m.user_id AS "userId",m.role,u.name,u.email FROM organization_memberships m JOIN users u ON u.id=m.user_id WHERE m.id=$1 AND m.organization_id=$2 LIMIT 1`, [req.params.membershipId, organizationId]);
    const member = current.rows[0];
    if (!member) return res.status(404).json({ error: 'Team member not found' });
    if (normalizeFleetRole(member.role) === 'owner') return res.status(409).json({ error: 'Workspace owner cannot be modified from team management' });
    const nextRole = role || normalizeFleetRole(member.role);
    const nextStatus = status || 'active';
    await db.query(`UPDATE organization_memberships SET role=$3,status=$4 WHERE id=$1 AND organization_id=$2`, [member.id, organizationId, nextRole, nextStatus]);
    if (nextRole === 'technician' && nextStatus === 'active') {
      const tech = await db.query(`SELECT id FROM technicians WHERE organization_id=$1 AND user_id=$2 LIMIT 1`, [organizationId, member.userId]);
      if (!tech.rowCount) await db.query(`INSERT INTO technicians(id,organization_id,user_id,name,active) VALUES($1,$2,$3,$4,true)`, [randomUUID(), organizationId, member.userId, member.name || member.email]);
      else await db.query(`UPDATE technicians SET active=true,name=COALESCE(NULLIF(name,''),$3) WHERE organization_id=$1 AND user_id=$2`, [organizationId, member.userId, member.name || member.email]);
    } else {
      await db.query(`UPDATE technicians SET active=false WHERE organization_id=$1 AND user_id=$2`, [organizationId, member.userId]);
    }
    return res.json({ updated: true, role: nextRole, status: nextStatus });
  } catch (error) { return fleetAuthFailure(res, error); }
  finally { if (db) await db.end(); }
});
