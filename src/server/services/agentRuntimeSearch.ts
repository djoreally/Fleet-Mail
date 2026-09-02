import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { contacts, customers, inboxes, maintenanceSchedules, vehicles, workOrders } from '../../db/drizzleSchema.js';
import { prospectActivities, prospectContacts, prospects } from '../../db/prospectSchema.js';
import { getAgentMailClient } from './agentmail.js';
import { serverConfig } from '../config.js';

const STOP_WORDS=new Set(['the','and','for','with','that','this','from','about','what','who','where','when','find','show','look','search','email','emails','contact','contacts','prospect','prospects','customer','customers','fleet','please','tell','have','has','had','can','could','would','should','there','their','them','they','into','your','you','our','his','her','its','are','was','were','been']);
function termsFrom(input:string){
 const emails=(input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).map(v=>v.toLowerCase());
 const words=input.toLowerCase().replace(/[^a-z0-9@._+-]+/g,' ').split(/\s+/).filter(v=>v.length>=3&&!STOP_WORDS.has(v));
 return [...new Set([...emails,...words])].slice(0,8);
}
function matchesTerms(value:unknown,terms:string[]){const hay=String(value??'').toLowerCase();return terms.some(term=>hay.includes(term));}
function messageText(message:any){return [message?.from,message?.to,message?.cc,message?.subject,message?.text,message?.body,message?.preview,message?.snippet].flat(Infinity).filter(Boolean).join(' ');}
function mailAddress(value:unknown){if(Array.isArray(value))return value.map(mailAddress).filter(Boolean).join(', ');if(value&&typeof value==='object'){const v=value as Record<string,unknown>;return String(v.email||v.address||v.value||v.name||'');}return String(value??'');}

export async function searchAgentRuntimeContext(organizationId:string,userText:string){
 const db=getDb();if(!db)return {query:userText,terms:[],fleet:{},emails:[]};
 const terms=termsFrom(userText);if(!terms.length)return {query:userText,terms,fleet:{},emails:[]};
 const like=(column:any)=>or(...terms.map(term=>ilike(column,`%${term}%`)))!;
 const [prospectRows,prospectContactRows,customerRows,contactRows,vehicleRows,workOrderRows,maintenanceRows,activityRows]=await Promise.all([
  db.select({id:prospects.id,companyName:prospects.companyName,industry:prospects.industry,generalEmail:prospects.generalEmail,phone:prospects.phone,stage:prospects.stage,qualificationScore:prospects.qualificationScore,researchSummary:prospects.researchSummary,nextFollowUpAt:prospects.nextFollowUpAt}).from(prospects).where(and(eq(prospects.organizationId,organizationId),or(like(prospects.companyName),like(prospects.generalEmail),like(prospects.industry),like(prospects.serviceArea)))).orderBy(desc(prospects.updatedAt)).limit(8),
  db.select({id:prospectContacts.id,prospectId:prospectContacts.prospectId,name:prospectContacts.name,email:prospectContacts.email,phone:prospectContacts.phone,title:prospectContacts.title,isDecisionMaker:prospectContacts.isDecisionMaker,companyName:prospects.companyName}).from(prospectContacts).leftJoin(prospects,and(eq(prospects.id,prospectContacts.prospectId),eq(prospects.organizationId,organizationId))).where(and(eq(prospectContacts.organizationId,organizationId),or(like(prospectContacts.name),like(prospectContacts.email),like(prospectContacts.title),like(prospects.companyName)))).limit(12),
  db.select({id:customers.id,name:customers.name,accountNumber:customers.accountNumber,primaryContactName:customers.primaryContactName,primaryContactEmail:customers.primaryContactEmail,billingEmail:customers.billingEmail,phone:customers.phone,status:customers.status,notes:customers.notes}).from(customers).where(and(eq(customers.organizationId,organizationId),or(like(customers.name),like(customers.primaryContactName),like(customers.primaryContactEmail),like(customers.billingEmail),like(customers.accountNumber)))).limit(8),
  db.select({id:contacts.id,customerId:contacts.customerId,name:contacts.name,email:contacts.email,phone:contacts.phone,role:contacts.role,isPrimary:contacts.isPrimary,companyName:customers.name}).from(contacts).leftJoin(customers,and(eq(customers.id,contacts.customerId),eq(customers.organizationId,organizationId))).where(and(eq(contacts.organizationId,organizationId),or(like(contacts.name),like(contacts.email),like(contacts.role),like(customers.name)))).limit(12),
  db.select({id:vehicles.id,customerId:vehicles.customerId,unitNumber:vehicles.unitNumber,vin:vehicles.vin,year:vehicles.year,make:vehicles.make,model:vehicles.model,engine:vehicles.engine,mileage:vehicles.mileage,engineHours:vehicles.engineHours,status:vehicles.status,assignedDriver:vehicles.assignedDriver,specifications:vehicles.specifications}).from(vehicles).where(and(eq(vehicles.organizationId,organizationId),or(like(vehicles.unitNumber),like(vehicles.vin),like(vehicles.make),like(vehicles.model),like(vehicles.assignedDriver)))).limit(10),
  db.select({id:workOrders.id,number:workOrders.number,status:workOrders.status,priority:workOrders.priority,customerId:workOrders.customerId,vehicleId:workOrders.vehicleId,scheduledAt:workOrders.scheduledAt,purchaseOrderNumber:workOrders.purchaseOrderNumber,requestedServices:workOrders.requestedServices,complaint:workOrders.complaint,diagnosis:workOrders.diagnosis}).from(workOrders).where(and(eq(workOrders.organizationId,organizationId),or(like(workOrders.number),like(workOrders.status),like(workOrders.purchaseOrderNumber),like(workOrders.complaint),like(workOrders.diagnosis)))).orderBy(desc(workOrders.updatedAt)).limit(10),
  db.select({id:maintenanceSchedules.id,vehicleId:maintenanceSchedules.vehicleId,serviceCode:maintenanceSchedules.serviceCode,program:maintenanceSchedules.program,nextDueAt:maintenanceSchedules.nextDueAt,nextDueMileage:maintenanceSchedules.nextDueMileage,nextDueEngineHours:maintenanceSchedules.nextDueEngineHours,active:maintenanceSchedules.active}).from(maintenanceSchedules).where(and(eq(maintenanceSchedules.organizationId,organizationId),or(like(maintenanceSchedules.serviceCode),like(maintenanceSchedules.program)))).limit(10),
  db.select({prospectId:prospectActivities.prospectId,kind:prospectActivities.kind,direction:prospectActivities.direction,channel:prospectActivities.channel,subject:prospectActivities.subject,summary:prospectActivities.summary,occurredAt:prospectActivities.occurredAt}).from(prospectActivities).where(and(eq(prospectActivities.organizationId,organizationId),or(like(prospectActivities.subject),like(prospectActivities.summary)))).orderBy(desc(prospectActivities.occurredAt)).limit(12),
 ]);

 let emails:any[]=[];
 try{
  const client=getAgentMailClient() as any;
  if(client){
   const orgInboxes=await db.select({externalInboxId:inboxes.externalInboxId,email:inboxes.email}).from(inboxes).where(and(eq(inboxes.organizationId,organizationId),eq(inboxes.isActive,true))).limit(3);
   const inboxIds=(orgInboxes.length?orgInboxes.map(row=>row.externalInboxId||row.email):[serverConfig.defaultInbox]).filter(Boolean) as string[];
   const collected:any[]=[];
   for(const inboxId of inboxIds){
    const result=await client.inboxes.messages.list(inboxId,{limit:100});
    for(const message of Array.isArray(result?.messages)?result.messages:[]){if(matchesTerms(messageText(message),terms))collected.push({inboxId,id:message.message_id||message.messageId||message.id,from:mailAddress(message.from),to:mailAddress(message.to),subject:String(message.subject||''),preview:String(message.text||message.preview||message.snippet||'').slice(0,1200),createdAt:message.created_at||message.createdAt||null});}
   }
   emails=collected.sort((a,b)=>new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime()).slice(0,15);
  }
 }catch(error){console.warn('Agent runtime email search unavailable:',error instanceof Error?error.message:error);}
 return {query:userText,terms,fleet:{prospects:prospectRows,prospectContacts:prospectContactRows,fleetAccounts:customerRows,contacts:contactRows,vehicles:vehicleRows,workOrders:workOrderRows,maintenance:maintenanceRows,prospectActivity:activityRows},emails};
}
