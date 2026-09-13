import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { agentInboxEvents, agentRuns } from '../../db/drizzleSchema.js';
import { fleetAuthFailure, requireFleetOrganization, requireFleetRole } from '../services/fleetAuth.js';

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
