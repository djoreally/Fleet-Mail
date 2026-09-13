import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, or } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { agentmailPods, agentmailWebhooks, inboxes, organizations } from '../../db/drizzleSchema.js';
import { getAgentMailClient } from './agentmail.js';

function database(){const db=getDb();if(!db)throw new Error('Database is not configured');return db;}
function client(){const value=getAgentMailClient() as any;if(!value)throw new Error('AgentMail is not configured');return value;}
function text(value:unknown,max=300){return String(value??'').trim().slice(0,max);}
function normalizeUsername(value:unknown){return text(value,63).toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'');}
function publicWebhookUrl(){
 const explicit=process.env.APP_PUBLIC_URL?.trim();
 if(explicit)return `${explicit.replace(/\/$/,'')}/api/webhooks/agentmail`;
 const productionHost=process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
 if(productionHost)return `https://${productionHost.replace(/^https?:\/\//,'').replace(/\/$/,'')}/api/webhooks/agentmail`;
 return 'https://fleetmail.vercel.app/api/webhooks/agentmail';
}
function encryptScopedKey(value:string){
 const secret=process.env.TENANT_SECRET_KEK_REF?.trim();
 if(!secret)throw new Error('Tenant secret encryption is not configured');
 const key=createHash('sha256').update(secret).digest();
 const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,iv);
 const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 const tag=cipher.getAuthTag();
 return `enc:v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}
function webhookRows(result:any){return Array.isArray(result?.webhooks)?result.webhooks:Array.isArray(result)?result:[];}
function podRows(result:any){return Array.isArray(result?.pods)?result.pods:Array.isArray(result)?result:[];}
function inboxRows(result:any){return Array.isArray(result?.inboxes)?result.inboxes:Array.isArray(result)?result:[];}
function podId(row:any){return text(row?.podId||row?.pod_id||row?.id,200);}
function inboxId(row:any){return text(row?.inboxId||row?.inbox_id||row?.id,200);}
function webhookId(row:any){return text(row?.webhookId||row?.webhook_id||row?.id,200);}
function inboxAddress(row:any,username:string){return text(row?.address||row?.email||row?.inboxAddress,320)||`${username}@agentmail.to`;}

export interface AgentMailTenantProvisioningInput{businessName:string;inboxUsername:string}

export class AgentMailTenantProvisioningService{
 async status(organizationId:string){
  const db=database();
  const [organization]=await db.select().from(organizations).where(eq(organizations.id,organizationId)).limit(1);
  const [pod]=await db.select().from(agentmailPods).where(eq(agentmailPods.organizationId,organizationId)).limit(1);
  const activeInboxes=await db.select().from(inboxes).where(and(eq(inboxes.organizationId,organizationId),eq(inboxes.isActive,true))).limit(5);
  if(!pod&&activeInboxes.length){
   return{ready:true,mode:'legacy' as const,organizationName:organization?.name||'',inboxAddress:activeInboxes[0].email,status:'active'};
  }
  if(!pod)return{ready:false,mode:'tenant' as const,organizationName:organization?.name||'',inboxAddress:null,status:'pending'};
  const [tenantInbox]=await db.select().from(inboxes).where(and(eq(inboxes.organizationId,organizationId),eq(inboxes.podId,pod.id),eq(inboxes.isActive,true))).limit(1);
  if(!tenantInbox)return{ready:false,mode:'tenant' as const,organizationName:organization?.name||'',inboxAddress:null,status:'pod_ready'};
  const [webhook]=await db.select().from(agentmailWebhooks).where(and(eq(agentmailWebhooks.organizationId,organizationId),eq(agentmailWebhooks.podId,pod.id),eq(agentmailWebhooks.status,'active'))).limit(1);
  const credentialsReady=Boolean(pod.podKeySecretRef);
  return{ready:Boolean(credentialsReady&&webhook),mode:'tenant' as const,organizationName:organization?.name||'',inboxAddress:tenantInbox.email,status:webhook&&credentialsReady?'active':credentialsReady?'credentials_ready':'inbox_ready'};
 }

 async provision(organizationId:string,input:AgentMailTenantProvisioningInput){
  const db=database();const mail=client();
  const businessName=text(input.businessName,200);const username=normalizeUsername(input.inboxUsername);
  if(!businessName)throw new Error('Business name is required');
  if(!/^[a-z0-9][a-z0-9._-]{1,62}$/i.test(username))throw new Error('Inbox name must be 2–63 letters, numbers, dots, dashes, or underscores');

  await db.update(organizations).set({name:businessName}).where(eq(organizations.id,organizationId));

  let [pod]=await db.select().from(agentmailPods).where(eq(agentmailPods.organizationId,organizationId)).limit(1);
  if(!pod){
   const listed=await mail.pods.list({clientId:organizationId});
   let remote=podRows(listed).find((item:any)=>text(item?.clientId||item?.client_id,200)===organizationId);
   if(!remote)remote=await mail.pods.create({clientId:organizationId});
   const externalPodId=podId(remote);if(!externalPodId)throw new Error('AgentMail did not return a Pod id');
   [pod]=await db.insert(agentmailPods).values({id:randomUUID(),organizationId,externalPodId,clientId:organizationId,status:'active'}).returning();
  }

  let [tenantInbox]=await db.select().from(inboxes).where(and(eq(inboxes.organizationId,organizationId),eq(inboxes.podId,pod.id),eq(inboxes.isActive,true))).limit(1);
  if(!tenantInbox){
   const listed=await mail.pods.inboxes.list(pod.externalPodId);
   let remote=inboxRows(listed).find((item:any)=>text(item?.username,100).toLowerCase()===username);
   if(!remote)remote=await mail.pods.inboxes.create(pod.externalPodId,{username,displayName:businessName});
   const externalInboxId=inboxId(remote);if(!externalInboxId)throw new Error('AgentMail did not return an inbox id');
   const email=inboxAddress(remote,username);
   const [existingByAddress]=await db.select().from(inboxes).where(and(eq(inboxes.organizationId,organizationId),or(eq(inboxes.externalInboxId,externalInboxId),eq(inboxes.email,email)))).limit(1);
   if(existingByAddress){
    [tenantInbox]=await db.update(inboxes).set({podId:pod.id,externalInboxId,email,name:businessName,isActive:true}).where(eq(inboxes.id,existingByAddress.id)).returning();
   }else{
    [tenantInbox]=await db.insert(inboxes).values({id:randomUUID(),organizationId,podId:pod.id,externalInboxId,email,name:businessName,provider:'agentmail',isActive:true}).returning();
   }
  }

  if(!pod.podKeySecretRef){
   const credential=await mail.pods.apiKeys.create(pod.externalPodId,{name:`fleetmail-${organizationId}`});
   const apiKey=text(credential?.apiKey||credential?.api_key||credential?.key,10000);
   if(!apiKey)throw new Error('AgentMail did not return a Pod-scoped key');
   const sealed=encryptScopedKey(apiKey);
   [pod]=await db.update(agentmailPods).set({podKeySecretRef:sealed,updatedAt:new Date()}).where(eq(agentmailPods.id,pod.id)).returning();
  }

  let [localWebhook]=await db.select().from(agentmailWebhooks).where(and(eq(agentmailWebhooks.organizationId,organizationId),eq(agentmailWebhooks.podId,pod.id),eq(agentmailWebhooks.status,'active'))).limit(1);
  if(!localWebhook){
   const url=publicWebhookUrl();const listed=await mail.webhooks.list();
   let remote=webhookRows(listed).find((item:any)=>String(item?.url||'')===url&&Array.isArray(item?.podIds||item?.pod_ids)&&(item?.podIds||item?.pod_ids).includes(pod.externalPodId));
   if(!remote)remote=await mail.webhooks.create({url,eventTypes:['message.received','message.sent'],podIds:[pod.externalPodId]});
   const externalWebhookId=webhookId(remote);if(!externalWebhookId)throw new Error('AgentMail did not return a webhook id');
   [localWebhook]=await db.insert(agentmailWebhooks).values({id:randomUUID(),organizationId,podId:pod.id,inboxId:tenantInbox.id,externalWebhookId,signingSecretRef:'env:AGENTMAIL_WEBHOOK_SECRET',eventTypes:['message.received','message.sent'],status:'active'}).returning();
  }
  return{ready:true,status:'active',mode:'tenant',organizationName:businessName,inboxAddress:tenantInbox.email,podId:pod.externalPodId,webhookId:localWebhook.externalWebhookId};
 }
}
export const agentMailTenantProvisioningService=new AgentMailTenantProvisioningService();
