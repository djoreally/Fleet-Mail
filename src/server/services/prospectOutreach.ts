import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/index.js';
import { prospectActivities, prospectContacts, prospects } from '../../db/prospectSchema.js';
import { callAICompletion } from './ai.js';

function database(){const db=getDb();if(!db)throw new Error('Database is not configured');return db;}
const text=(value:unknown,max=10000)=>String(value??'').trim().slice(0,max);

export class ProspectOutreachService {
 async draft(organizationId:string,prospectId:string,input:Record<string,unknown>={}){
  const db=database();
  const [prospect]=await db.select().from(prospects).where(and(eq(prospects.organizationId,organizationId),eq(prospects.id,prospectId))).limit(1);
  if(!prospect)throw new Error('Prospect not found');
  const contacts=await db.select().from(prospectContacts).where(and(eq(prospectContacts.organizationId,organizationId),eq(prospectContacts.prospectId,prospectId))).orderBy(desc(prospectContacts.isDecisionMaker),prospectContacts.name);
  const requestedContactId=text(input.contactId,100);
  const contact=(requestedContactId?contacts.find(item=>item.id===requestedContactId):undefined) || contacts.find(item=>item.isDecisionMaker&&item.email) || contacts.find(item=>item.email);
  const recipient=text(input.to,320)||contact?.email||prospect.generalEmail||'';
  if(!recipient)throw new Error('A prospect or contact email is required before drafting outreach');
  const objective=text(input.objective,1000)||'Introduce our fleet service and earn a short conversation about their maintenance needs.';
  const evidence=Array.isArray(prospect.fleetEvidence)?prospect.fleetEvidence.slice(0,12):[];
  const sources=Array.isArray(prospect.researchSources)?prospect.researchSources.slice(0,12):[];
  const prompt=`Draft a concise B2B fleet-service prospecting email. Use only the supplied prospect facts; never invent fleet size, vehicle types, locations, pain points, or relationships. If evidence is weak, keep personalization general. Return valid JSON only with keys subject and text. The email should sound human, specific, low-pressure, and have one clear CTA. Do not mention AI, Firecrawl, scraping, qualification scores, or research sources.\nObjective: ${objective}\nCompany: ${prospect.companyName}\nRecipient: ${contact?.name||recipient}\nRecipient title: ${contact?.title||'unknown'}\nIndustry: ${prospect.industry||'unknown'}\nService area: ${prospect.serviceArea||'unknown'}\nEstimated fleet size: ${prospect.estimatedFleetSize??'unsupported'}\nVehicle types: ${JSON.stringify(prospect.vehicleTypes||[])}\nResearch summary: ${prospect.researchSummary||'none'}\nFleet evidence: ${JSON.stringify(evidence)}\nSources: ${JSON.stringify(sources)}`;
  const ai=await callAICompletion([{role:'user',content:prompt}],'You write evidence-grounded B2B fleet outreach. Output JSON only.');
  let parsed:{subject?:string;text?:string}={};
  try{parsed=JSON.parse(ai.content.replace(/^```json\s*/,'').replace(/\s*```$/,''));}catch{throw new Error('Outreach draft could not be structured safely');}
  const subject=text(parsed.subject,998);const body=text(parsed.text,100000);
  if(!subject||!body)throw new Error('Outreach draft is incomplete');
  return {to:recipient,subject,text:body,prospectId,contactId:contact?.id||undefined,grounded:true};
 }

 async recordSent(organizationId:string,prospectId:string,input:Record<string,unknown>){
  const db=database();
  const [prospect]=await db.select().from(prospects).where(and(eq(prospects.organizationId,organizationId),eq(prospects.id,prospectId))).limit(1);
  if(!prospect)throw new Error('Prospect not found');
  const to=text(input.to,320);const subject=text(input.subject,998);const body=text(input.text,100000);const externalMessageId=text(input.externalMessageId,300);
  const [activity]=await db.insert(prospectActivities).values({id:randomUUID(),organizationId,prospectId,kind:'outreach_email',direction:'outbound',channel:'agentmail',subject,summary:body.slice(0,10000),externalMessageId:externalMessageId||null,metadata:{to,contactId:text(input.contactId,100)||null}}).returning();
  const nextStage=['new','researching','qualified'].includes(prospect.stage)?'outreach':prospect.stage;
  await db.update(prospects).set({stage:nextStage,lastContactedAt:new Date(),updatedAt:new Date()}).where(and(eq(prospects.organizationId,organizationId),eq(prospects.id,prospectId)));
  return activity;
 }
}

export const prospectOutreachService=new ProspectOutreachService();