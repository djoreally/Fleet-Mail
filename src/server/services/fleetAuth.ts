import { createHash, randomUUID } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import { and, eq } from 'drizzle-orm';
import type { Request } from 'express';
import { getDb } from '../../db/index.js';
import { organizationMemberships, organizations, users } from '../../db/drizzleSchema.js';
import { serverConfig } from '../config.js';
import { fleetRoleHasPermission, normalizeFleetRole, permissionsForRole, type FleetPermission, type FleetRole } from './rbac.js';

export class FleetAuthError extends Error { constructor(public status: number, message: string) { super(message); } }
type FleetRequest = Request & { fleetOrganizationId?: string; fleetMembershipRole?: FleetRole; fleetUserId?: string; fleetAuthSubject?: string };

function database() { const value=getDb(); if(!value) throw new FleetAuthError(503,'Production database is not configured'); return value; }
function databaseUrl() { const value=process.env.DATABASE_URL||process.env.NEON_DATABASE_URL; if(!value) throw new FleetAuthError(503,'Production database is not configured'); return value; }

export function authUser(payload:any){
  const roots=[payload,payload?.data,payload?.session,payload?.data?.session];
  const identities=[payload?.user,payload?.data?.user,payload?.session?.user,payload?.data?.session?.user,payload?.session?.data?.user,payload?.data?.session?.data?.user];
  const isIdentity=(value:any)=>value&&typeof value==='object'&&Boolean(value.id||value.userId||value.user_id||value.sub);
  return identities.find(isIdentity)||roots.find(isIdentity)||null;
}
function verifiedBearerClaims(authorization:string){try{const encoded=authorization.slice('Bearer '.length).split('.')[1];if(!encoded)return null;return JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));}catch{return null;}}

async function claimInvitation(req:Request,user:{id:string;email:string;name:string|null}){
  const inviteId=String(req.header('x-fleet-invite-id')||'').trim();
  const inviteToken=String(req.header('x-fleet-invite-token')||'').trim();
  if(!inviteId||!inviteToken)return null;
  const hash=createHash('sha256').update(inviteToken).digest('hex');
  const pool=new Pool({connectionString:databaseUrl()});
  try{
    await pool.query('BEGIN');
    const found=await pool.query(`SELECT id,organization_id AS "organizationId",email,role,status,token_hash AS "tokenHash",expires_at AS "expiresAt" FROM organization_invitations WHERE id=$1 FOR UPDATE`,[inviteId]);
    const invitation=found.rows[0];
    if(!invitation)throw new FleetAuthError(404,'Invitation not found');
    if(invitation.status==='accepted') { await pool.query('COMMIT'); return {organizationId:String(invitation.organizationId),role:normalizeFleetRole(invitation.role)}; }
    if(invitation.status!=='pending')throw new FleetAuthError(409,'Invitation is no longer pending');
    if(new Date(invitation.expiresAt).getTime()<=Date.now()){
      await pool.query(`UPDATE organization_invitations SET status='expired',updated_at=now() WHERE id=$1`,[inviteId]);
      await pool.query('COMMIT'); throw new FleetAuthError(410,'Invitation has expired');
    }
    if(String(invitation.email).toLowerCase()!==user.email.toLowerCase())throw new FleetAuthError(403,'Invitation email does not match the signed-in user');
    if(String(invitation.tokenHash)!==hash)throw new FleetAuthError(403,'Invitation token is invalid');
    const role=normalizeFleetRole(invitation.role); if(role==='owner')throw new FleetAuthError(400,'Owner invitations are not supported');

    const existingMembership=await pool.query(`SELECT id FROM organization_memberships WHERE organization_id=$1 AND user_id=$2 LIMIT 1`,[invitation.organizationId,user.id]);
    if(existingMembership.rowCount) await pool.query(`UPDATE organization_memberships SET role=$3,status='active' WHERE organization_id=$1 AND user_id=$2`,[invitation.organizationId,user.id,role]);
    else await pool.query(`INSERT INTO organization_memberships(id,organization_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')`,[randomUUID(),invitation.organizationId,user.id,role]);

    if(role==='technician'){
      const existingTech=await pool.query(`SELECT id FROM technicians WHERE organization_id=$1 AND user_id=$2 LIMIT 1`,[invitation.organizationId,user.id]);
      if(!existingTech.rowCount)await pool.query(`INSERT INTO technicians(id,organization_id,user_id,name,active) VALUES($1,$2,$3,$4,true)`,[randomUUID(),invitation.organizationId,user.id,user.name||user.email]);
      else await pool.query(`UPDATE technicians SET active=true WHERE organization_id=$1 AND user_id=$2`,[invitation.organizationId,user.id]);
    }
    await pool.query(`UPDATE organization_invitations SET status='accepted',accepted_by_user_id=$2,accepted_at=now(),updated_at=now() WHERE id=$1`,[inviteId,user.id]);
    await pool.query('COMMIT'); return {organizationId:String(invitation.organizationId),role};
  }catch(error){try{await pool.query('ROLLBACK');}catch{}throw error;}finally{await pool.end();}
}

export async function requireFleetOrganization(req:Request):Promise<string>{
  const fleetReq=req as FleetRequest;if(fleetReq.fleetOrganizationId)return fleetReq.fleetOrganizationId;
  const authorization=req.header('authorization');if(!authorization?.startsWith('Bearer '))throw new FleetAuthError(401,'Authentication required');
  const response=await fetch(`${serverConfig.neonAuthUrl.replace(/\/$/,'')}/get-session`,{headers:{authorization,accept:'application/json'}});
  if(!response.ok)throw new FleetAuthError(401,'Your session is invalid or expired');
  const identity=authUser(await response.json());const claims=verifiedBearerClaims(authorization);
  const subject=String(identity?.id||identity?.userId||identity?.user_id||identity?.sub||claims?.sub||'');
  const email=String(identity?.email||identity?.emailAddress||identity?.email_address||identity?.user?.email||claims?.email||`${subject}@fleet.local`).toLowerCase();
  if(!subject||!email)throw new FleetAuthError(401,'Authenticated user identity is incomplete');
  const db=database();let [user]=await db.select().from(users).where(eq(users.authSubject,subject)).limit(1);
  if(!user){const displayName=identity?.name||identity?.displayName||identity?.display_name||identity?.user_metadata?.name||email.split('@')[0];[user]=await db.insert(users).values({id:randomUUID(),authSubject:subject,email,name:String(displayName)}).returning();}
  const claimed=await claimInvitation(req,{id:user.id,email:user.email,name:user.name});
  const requested=req.header('x-organization-id')||claimed?.organizationId;
  let memberships=await db.select({organizationId:organizationMemberships.organizationId,role:organizationMemberships.role}).from(organizationMemberships).where(and(eq(organizationMemberships.userId,user.id),eq(organizationMemberships.status,'active')));
  if(!memberships.length){const organizationId=randomUUID();await db.insert(organizations).values({id:organizationId,name:`${user.name}'s Fleet`,slug:`fleet-${subject.replace(/[^a-z0-9]/gi,'').slice(0,12).toLowerCase()}-${organizationId.slice(0,6)}`});await db.insert(organizationMemberships).values({id:randomUUID(),organizationId,userId:user.id,role:'owner',status:'active'});memberships=[{organizationId,role:'owner'}];}
  const selected=requested?memberships.find(item=>item.organizationId===requested):memberships[0];if(!selected)throw new FleetAuthError(403,'You do not have access to this organization');
  fleetReq.fleetOrganizationId=selected.organizationId;fleetReq.fleetMembershipRole=normalizeFleetRole(selected.role);fleetReq.fleetUserId=user.id;fleetReq.fleetAuthSubject=subject;return selected.organizationId;
}
export async function requireFleetRole(req:Request,allowedRoles:FleetRole[]){await requireFleetOrganization(req);const role=normalizeFleetRole((req as FleetRequest).fleetMembershipRole);if(!allowedRoles.includes(role))throw new FleetAuthError(403,'Your organization role does not permit this operation');return role;}
export async function requireFleetPermission(req:Request,permission:FleetPermission){await requireFleetOrganization(req);const role=normalizeFleetRole((req as FleetRequest).fleetMembershipRole);if(!fleetRoleHasPermission(role,permission))throw new FleetAuthError(403,`Your organization role does not permit ${permission}`);return role;}
export async function getFleetAccessContext(req:Request){const organizationId=await requireFleetOrganization(req);const fleetReq=req as FleetRequest;const role=normalizeFleetRole(fleetReq.fleetMembershipRole);return{organizationId,userId:fleetReq.fleetUserId||null,role,permissions:permissionsForRole(role)};}
export function fleetAuthFailure(res:any,error:unknown){const status=error instanceof FleetAuthError?error.status:500;return res.status(status).json({error:error instanceof Error?error.message:'Fleet request failed'});}
