import { randomUUID } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { agentRuns } from '../../db/drizzleSchema.js';
import { prospectingService } from './prospecting.js';
import { prospectOutreachService } from './prospectOutreach.js';

function database(){const db=getDb();if(!db)throw new Error('Database is not configured');return db;}
function databaseUrl(){const url=process.env.DATABASE_URL||process.env.NEON_DATABASE_URL;if(!url)throw new Error('Database is not configured');return url;}

export class ProspectAgentQueueService {
  async enqueueAttention(organizationId:string){
    const db=database();
    const attention=await prospectingService.attentionQueue(organizationId);
    const candidates=attention.items.filter(item=>item.lastActivityDirection!=='inbound' && ['Follow-up is overdue','Active opportunity has been quiet for '+item.ageDays+' days','No reply after '+item.ageDays+' days','Qualified prospect has not been contacted','Follow-up is due within 24 hours'].includes(item.attentionReason));
    if(!candidates.length)return {queued:0,skipped:0,items:[]};
    const active=await db.select({entityId:agentRuns.entityId}).from(agentRuns).where(and(
      eq(agentRuns.organizationId,organizationId),
      eq(agentRuns.kind,'prospect_followup_draft'),
      inArray(agentRuns.status,['queued','running'])
    ));
    const activeIds=new Set(active.map(row=>row.entityId).filter(Boolean));
    const items=[] as Array<{runId:string;prospectId:string;companyName:string}>;
    let skipped=0;
    for(const item of candidates){
      if(activeIds.has(item.id)){skipped++;continue;}
      const runId=randomUUID();
      await db.insert(agentRuns).values({
        id:runId,organizationId,kind:'prospect_followup_draft',status:'queued',
        entityType:'prospect',entityId:item.id,promptVersion:'prospect-followup-v1',
        input:{companyName:item.companyName,attentionReason:item.attentionReason,suggestedNextAction:item.suggestedNextAction,attentionPriority:item.attentionPriority},
        availableAt:new Date(),attempts:0,maxAttempts:3,
      });
      items.push({runId,prospectId:item.id,companyName:item.companyName});
      activeIds.add(item.id);
    }
    return {queued:items.length,skipped,items};
  }

  async process(organizationId:string,limit=5,workerId=`fleetmail-${randomUUID()}`){
    const pool=new Pool({connectionString:databaseUrl()});
    const results:Array<Record<string,unknown>>=[];
    try{
      const max=Math.max(1,Math.min(10,Math.trunc(limit)||5));
      for(let i=0;i<max;i++){
        const claim=await pool.query(`
          UPDATE public.agent_runs
             SET status='running', locked_at=now(), locked_by=$2,
                 attempts=attempts+1, started_at=now(), updated_at=now()
           WHERE id=(
             SELECT id FROM public.agent_runs
              WHERE organization_id=$1
                AND kind='prospect_followup_draft'
                AND status='queued'
                AND available_at<=now()
                AND attempts<max_attempts
              ORDER BY available_at ASC, created_at ASC
              FOR UPDATE SKIP LOCKED
              LIMIT 1
           )
          RETURNING id,entity_id,attempts,max_attempts,input
        `,[organizationId,workerId]);
        const run=claim.rows[0];
        if(!run)break;
        try{
          const draft=await prospectOutreachService.draft(organizationId,String(run.entity_id),{objective:'Write the next concise follow-up based on the current prospect record and prior sales context. Do not claim facts that are not in the record.'});
          await pool.query(`UPDATE public.agent_runs SET status='succeeded',output=$3::jsonb,error=NULL,completed_at=now(),locked_at=NULL,locked_by=NULL,updated_at=now() WHERE organization_id=$1 AND id=$2`,[organizationId,run.id,JSON.stringify({draft,sendRequiresConfirmation:true})]);
          results.push({runId:run.id,prospectId:run.entity_id,status:'succeeded',draft});
        }catch(error){
          const message=error instanceof Error?error.message:String(error);
          const retry=Number(run.attempts)<Number(run.max_attempts);
          await pool.query(`UPDATE public.agent_runs SET status=$3,error=$4,available_at=CASE WHEN $3='queued' THEN now()+interval '15 minutes' ELSE available_at END,completed_at=CASE WHEN $3='failed' THEN now() ELSE NULL END,locked_at=NULL,locked_by=NULL,updated_at=now() WHERE organization_id=$1 AND id=$2`,[organizationId,run.id,retry?'queued':'failed',message]);
          results.push({runId:run.id,prospectId:run.entity_id,status:retry?'queued':'failed',error:message});
        }
      }
      return {processed:results.length,results};
    }finally{await pool.end();}
  }
}

export const prospectAgentQueueService=new ProspectAgentQueueService();
