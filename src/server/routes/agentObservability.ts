import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { agentInboxEvents, agentRuns } from '../../db/drizzleSchema.js';
import { fleetAuthFailure, requireFleetOrganization, requireFleetRole } from '../services/fleetAuth.js';
import { prospectAgentQueueService } from '../services/prospectAgentQueue.js';
import { createAgentActionProposal } from '../services/agentActions.js';

export const agentObservabilityRouter=Router();

function database(){const db=getDb();if(!db)throw new Error('Database is not configured');return db;}
function limitOf(value:unknown){const n=Number(value);return Number.isFinite(n)?Math.max(1,Math.min(100,Math.trunc(n))):50;}

agentObservabilityRouter.get('/runs',async(req,res)=>{
  try{
    const organizationId=await requireFleetOrganization(req);
    await requireFleetRole(req,['owner','admin']);
    const rows=await database().select().from(agentRuns).where(eq(agentRuns.organizationId,organizationId)).orderBy(desc(agentRuns.startedAt)).limit(limitOf(req.query.limit));
    return res.json({runs:rows});
  }catch(error){return fleetAuthFailure(res,error);}
});

agentObservabilityRouter.get('/inbox-events',async(req,res)=>{
  try{
    const organizationId=await requireFleetOrganization(req);
    await requireFleetRole(req,['owner','admin']);
    const rows=await database().select().from(agentInboxEvents).where(eq(agentInboxEvents.organizationId,organizationId)).orderBy(desc(agentInboxEvents.receivedAt)).limit(limitOf(req.query.limit));
    return res.json({events:rows});
  }catch(error){return fleetAuthFailure(res,error);}
});


agentObservabilityRouter.post('/queue/prospects',async(req,res)=>{
  try{
    const organizationId=await requireFleetOrganization(req);
    await requireFleetRole(req,['owner','admin']);
    return res.status(202).json(await prospectAgentQueueService.enqueueAttention(organizationId));
  }catch(error){return fleetAuthFailure(res,error);}
});

agentObservabilityRouter.post('/queue/process',async(req,res)=>{
  try{
    const organizationId=await requireFleetOrganization(req);
    await requireFleetRole(req,['owner','admin']);
    return res.json(await prospectAgentQueueService.process(organizationId,Number(req.body?.limit)||5));
  }catch(error){return fleetAuthFailure(res,error);}
});


agentObservabilityRouter.post('/runs/:id/propose-send',async(req,res)=>{
  try{
    const organizationId=await requireFleetOrganization(req);
    await requireFleetRole(req,['owner','admin']);
    const [run]=await database().select().from(agentRuns).where(eq(agentRuns.id,req.params.id)).limit(1);
    if(!run||run.organizationId!==organizationId)return res.status(404).json({error:'Prepared draft not found'});
    if(run.kind!=='prospect_followup_draft'||run.status!=='succeeded')return res.status(409).json({error:'Agent run does not contain a sendable prepared draft'});
    const output=run.output&&typeof run.output==='object'&&!Array.isArray(run.output)?run.output as Record<string,unknown>:{};
    const draft=output.draft&&typeof output.draft==='object'&&!Array.isArray(output.draft)?output.draft as Record<string,unknown>:{};
    const to=String(draft.to||'').trim(),subject=String(draft.subject||'').trim(),body=String(draft.text||'').trim();
    if(!to||!subject||!body)return res.status(409).json({error:'Prepared draft is incomplete'});
    const payload={...draft,prospectId:run.entityId||draft.prospectId};
    return res.json({draft:payload,action:createAgentActionProposal('email.send',payload,organizationId),runId:run.id});
  }catch(error){return fleetAuthFailure(res,error);}
});
