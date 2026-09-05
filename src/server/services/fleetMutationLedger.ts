import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getDb } from '../../db/index.js';
import { auditEvents } from '../../db/drizzleSchema.js';
import { invalidateFleetKnowledge } from './fleetKnowledge.js';

const SENSITIVE_KEYS = new Set([
  'password','token','secret','authorization','apiKey','api_key','clientSecret','client_secret',
  'accessToken','refreshToken','confirmationToken','confirmation_token','cookie','set-cookie',
]);
const READ_ONLY_POSTS = [
  '/api/chat',
  '/api/rewrite-tone',
  '/api/generate-draft',
  '/api/summarize-email',
  '/api/vehicles/decode-vin',
  '/api/vehicles/decode-vins',
  '/api/agent/actions/propose',
];

function sanitize(value:unknown,depth=0):unknown{
  if(depth>2)return '[truncated]';
  if(Array.isArray(value))return value.slice(0,20).map(v=>sanitize(v,depth+1));
  if(!value||typeof value!=='object')return typeof value==='string'?value.slice(0,500):value;
  const out:Record<string,unknown>={};
  for(const [key,val] of Object.entries(value as Record<string,unknown>)){
    if(SENSITIVE_KEYS.has(key))out[key]='[redacted]';
    else out[key]=sanitize(val,depth+1);
  }
  return out;
}
function entityTypeFromPath(path:string){const parts=path.split('?')[0].split('/').filter(Boolean);return parts.slice(-2,-1)[0]||parts.at(-1)||'mutation';}
function isStateChangingRequest(req:Request){
  const method=req.method.toUpperCase();
  if(['PUT','PATCH','DELETE'].includes(method))return true;
  if(method!=='POST')return false;
  const path=req.originalUrl.split('?')[0];
  return !READ_ONLY_POSTS.some(readOnly=>path===readOnly||path.startsWith(`${readOnly}/`));
}

export function fleetMutationLedgerMiddleware(req:Request,res:Response,next:NextFunction){
  if(!isStateChangingRequest(req))return next();
  const startedAt=Date.now();
  let responseBody:unknown;
  const originalJson=res.json.bind(res);
  res.json=((body:unknown)=>{responseBody=body;return originalJson(body);}) as Response['json'];
  res.on('finish',()=>{
    if(res.statusCode>=400)return;
    const fleetReq=req as Request & { fleetOrganizationId?:string; fleetUserId?:string };
    const organizationId=fleetReq.fleetOrganizationId;
    if(!organizationId)return;
    const db=getDb();if(!db)return;
    const body=req.body&&typeof req.body==='object'?req.body:{};
    const result=responseBody&&typeof responseBody==='object'?responseBody as Record<string,unknown>:{};
    const entityId=String((result as any).id||(result as any).workOrderId||(result as any).prospectId||(result as any).authorizationId||(result as any).proposalId||(body as any).id||(body as any).workOrderId||(body as any).prospectId||(body as any).authorizationId||'').trim()||null;
    const actionKind=typeof (result as any).kind==='string'&&req.originalUrl.startsWith('/api/agent/actions/execute')?String((result as any).kind):null;
    const eventType=actionKind?`agent.${actionKind}.executed`:`http.${req.method.toLowerCase()}.success`;
    const payload={method:req.method,path:req.originalUrl,statusCode:res.statusCode,durationMs:Date.now()-startedAt,request:sanitize(body),response:sanitize(result)};
    void db.insert(auditEvents).values({id:randomUUID(),organizationId,actorUserId:fleetReq.fleetUserId||null,eventType,entityType:entityTypeFromPath(req.originalUrl),entityId,requestId:String(req.header('x-request-id')||req.header('x-vercel-id')||randomUUID()),payload}).then(()=>invalidateFleetKnowledge(organizationId)).catch(error=>console.warn('Fleet mutation ledger write failed:',error instanceof Error?error.message:error));
  });
  return next();
}
