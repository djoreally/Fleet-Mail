import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/index.js';
import { prospectActivities, prospectContacts, prospects } from '../../db/prospectSchema.js';
import { serverConfig } from '../config.js';
import { getAgentMailClient } from './agentmail.js';

function database(){const db=getDb();if(!db)throw new Error('Database is not configured');return db;}
function address(value:unknown):string{
  if(typeof value==='string'){
    const match=value.match(/<([^>]+)>/);return (match?.[1]||value).trim().toLowerCase();
  }
  if(Array.isArray(value))return address(value[0]);
  if(value&&typeof value==='object'){
    const source=value as Record<string,unknown>;
    return address(source.email||source.address||source.value||'');
  }
  return '';
}
function text(value:unknown,max=10000){return String(value??'').trim().slice(0,max);}

export class ProspectInboxSyncService{
 async sync(organizationId:string,limit=50){
  const client=getAgentMailClient() as any;if(!client)throw new Error('AgentMail is not configured');
  const db=database();const safeLimit=Math.min(100,Math.max(1,Number(limit)||50));
  const [prospectRows,contactRows]=await Promise.all([
    db.select().from(prospects).where(eq(prospects.organizationId,organizationId)),
    db.select().from(prospectContacts).where(eq(prospectContacts.organizationId,organizationId)),
  ]);
  const byEmail=new Map<string,{prospectId:string;contactId?:string}>();
  for(const prospect of prospectRows){const email=address(prospect.generalEmail);if(email)byEmail.set(email,{prospectId:prospect.id});}
  for(const contact of contactRows){const email=address(contact.email);if(email)byEmail.set(email,{prospectId:contact.prospectId,contactId:contact.id});}
  const result=await client.inboxes.messages.list(serverConfig.defaultInbox,{limit:safeLimit});
  const messages=Array.isArray(result?.messages)?result.messages:[];
  let matched=0,recorded=0,duplicates=0,ignored=0;
  for(const message of messages){
    const from=address(message?.from);const match=byEmail.get(from);if(!from||!match){ignored++;continue;}
    matched++;
    const externalMessageId=text(message?.message_id||message?.messageId||message?.id,300);
    if(externalMessageId){
      const [existing]=await db.select({id:prospectActivities.id}).from(prospectActivities).where(and(eq(prospectActivities.organizationId,organizationId),eq(prospectActivities.externalMessageId,externalMessageId))).limit(1);
      if(existing){duplicates++;continue;}
    }
    const prospect=prospectRows.find(item=>item.id===match.prospectId);if(!prospect){ignored++;continue;}
    const subject=text(message?.subject,998);const body=text(message?.text||message?.body||message?.preview||message?.snippet,10000);
    await db.insert(prospectActivities).values({
      id:randomUUID(),organizationId,prospectId:match.prospectId,kind:'reply_email',direction:'inbound',channel:'agentmail',subject:subject||null,summary:body||null,
      externalMessageId:externalMessageId||null,occurredAt:message?.created_at||message?.createdAt?new Date(message.created_at||message.createdAt):new Date(),metadata:{from,contactId:match.contactId||null,inboxId:serverConfig.defaultInbox},
    });
    const nextStage=['new','researching','qualified','outreach'].includes(prospect.stage)?'engaged':prospect.stage;
    await db.update(prospects).set({stage:nextStage,nextFollowUpAt:new Date(),updatedAt:new Date()}).where(and(eq(prospects.organizationId,organizationId),eq(prospects.id,match.prospectId)));
    recorded++;
  }
  return {scanned:messages.length,matched,recorded,duplicates,ignored};
 }
}
export const prospectInboxSyncService=new ProspectInboxSyncService();
