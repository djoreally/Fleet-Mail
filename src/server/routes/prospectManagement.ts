import { Pool } from '@neondatabase/serverless';
import { Router } from 'express';
import { FleetAuthError, fleetAuthFailure, requireFleetOrganization, requireFleetPermission } from '../services/fleetAuth.js';
import { prospectingService } from '../services/prospecting.js';
import { pagedProspects } from '../services/operationalListPaging.js';

export const prospectManagementRouter = Router();

const fail=(res:any,error:unknown)=>{
  if(error instanceof FleetAuthError)return fleetAuthFailure(res,error);
  const message=error instanceof Error?error.message:'Prospect operation failed';
  console.warn('Prospect operation rejected:',message);
  return res.status(/not found/i.test(message)?404:/required|invalid|must|valid|cursor/i.test(message)?400:500).json({error:message,code:'prospect_write_rejected'});
};

function normalizeProspectInput(input:Record<string,unknown>={}){
  const next={...input};
  if(typeof next.companyName==='string')next.companyName=next.companyName.trim();
  if(typeof next.website==='string'){
    const raw=next.website.trim();
    if(!raw)next.website=null;
    else next.website=/^https?:\/\//i.test(raw)?raw:`https://${raw}`;
  }
  for(const key of ['industry','serviceArea','phone','generalEmail'] as const){if(typeof next[key]==='string'&&!String(next[key]).trim())next[key]=null;}
  for(const key of ['estimatedFleetSize','opportunityValue','qualificationScore','probability'] as const){
    const value=next[key];
    if(value===''||value===null||value===undefined){next[key]=null;continue;}
    const numeric=Number(String(value).replace(/[$,]/g,''));
    if(Number.isFinite(numeric))next[key]=numeric;
  }
  return next;
}

prospectManagementRouter.get('/prospects',async(req,res)=>{
  try{
    const organizationId=await requireFleetOrganization(req);
    const page=await pagedProspects(organizationId,{search:req.query.search??req.query.q,stage:req.query.stage,cursor:req.query.cursor,limit:req.query.limit});
    return res.json({prospects:page.items,nextCursor:page.nextCursor,hasMore:page.hasMore});
  }catch(error){return fail(res,error)}
});

prospectManagementRouter.post('/prospects',async(req,res)=>{
  try{
    const organizationId=await requireFleetOrganization(req);
    await requireFleetPermission(req,'prospects.manage');
    return res.status(201).json({prospect:await prospectingService.create(organizationId,normalizeProspectInput(req.body??{}))});
  }catch(error){return fail(res,error)}
});

prospectManagementRouter.patch('/prospects/:id',async(req,res)=>{
  try{
    const organizationId=await requireFleetOrganization(req);
    await requireFleetPermission(req,'prospects.manage');
    return res.json({prospect:await prospectingService.update(organizationId,req.params.id,normalizeProspectInput(req.body??{}))});
  }catch(error){return fail(res,error)}
});

prospectManagementRouter.delete('/prospects/:id',async(req,res)=>{
  let pool:Pool|null=null;
  try{
    const organizationId=await requireFleetOrganization(req);
    await requireFleetPermission(req,'prospects.manage');
    const detail=await prospectingService.get(organizationId,req.params.id);
    if(detail.prospect.convertedCustomerId) return res.status(409).json({error:'Converted prospects cannot be deleted; retain the acquisition history.'});
    const url=process.env.DATABASE_URL||process.env.NEON_DATABASE_URL;
    if(!url)return res.status(503).json({error:'Database is not configured'});
    pool=new Pool({connectionString:url});
    const result=await pool.query('DELETE FROM public.prospects WHERE organization_id=$1 AND id=$2 RETURNING id',[organizationId,req.params.id]);
    if(!result.rowCount)return res.status(404).json({error:'Prospect not found'});
    return res.json({deleted:true,id:req.params.id});
  }catch(error){return fail(res,error)}
  finally{if(pool)await pool.end()}
});
