import { randomUUID } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { prospectActivities, prospectContacts, prospects } from '../../db/prospectSchema.js';
import { crawlWebsite } from './firecrawl.js';
import { callAICompletion } from './ai.js';

function database() { const db=getDb(); if(!db) throw new Error('Database is not configured'); return db; }
const required=(value:unknown,name:string,max=1000)=>{const v=String(value??'').trim();if(!v)throw new Error(`${name} is required`);return v.slice(0,max)};
const optional=(value:unknown,max=5000)=>{const v=String(value??'').trim();return v?v.slice(0,max):null};
const bounded=(value:unknown,min:number,max:number,fallback:number)=>{const n=value==null||value===''?fallback:Number(value);if(!Number.isFinite(n))return fallback;return Math.min(max,Math.max(min,Math.round(n)))};
const STAGES=new Set(['new','researching','qualified','outreach','engaged','meeting','proposal','won','lost','converted']);

function cleanWebsite(value:unknown){const raw=optional(value,1000);if(!raw)return null;try{const u=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);if(!['http:','https:'].includes(u.protocol))throw new Error();return u.toString();}catch{throw new Error('Website must be a valid public URL')}}
function jsonObject(value:unknown){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function stringArray(value:unknown,max=30){return Array.isArray(value)?value.slice(0,max).map(v=>String(v).trim()).filter(Boolean):[];}

export class ProspectingService {
 async list(organizationId:string, options:{search?:string;stage?:string}={}){
  const db=database();const filters=[eq(prospects.organizationId,organizationId)];
  if(options.stage&&STAGES.has(options.stage))filters.push(eq(prospects.stage,options.stage));
  if(options.search?.trim()){const q=`%${options.search.trim()}%`;filters.push(or(ilike(prospects.companyName,q),ilike(prospects.website,q),ilike(prospects.industry,q))!);}
  return db.select().from(prospects).where(and(...filters)).orderBy(desc(prospects.qualificationScore),desc(prospects.updatedAt)).limit(500);
 }
 async get(organizationId:string,id:string){
  const db=database();const [prospect]=await db.select().from(prospects).where(and(eq(prospects.organizationId,organizationId),eq(prospects.id,id))).limit(1);
  if(!prospect)throw new Error('Prospect not found');
  const [contacts,activities]=await Promise.all([
   db.select().from(prospectContacts).where(and(eq(prospectContacts.organizationId,organizationId),eq(prospectContacts.prospectId,id))).orderBy(desc(prospectContacts.isDecisionMaker),prospectContacts.name),
   db.select().from(prospectActivities).where(and(eq(prospectActivities.organizationId,organizationId),eq(prospectActivities.prospectId,id))).orderBy(desc(prospectActivities.occurredAt)).limit(200),
  ]);
  return {prospect,contacts,activities};
 }
 async create(organizationId:string,input:Record<string,unknown>){
  const stage=String(input.stage||'new');if(!STAGES.has(stage))throw new Error('Invalid prospect stage');
  const [row]=await database().insert(prospects).values({
   id:randomUUID(),organizationId,companyName:required(input.companyName,'Company name',300),website:cleanWebsite(input.website),industry:optional(input.industry,200),phone:optional(input.phone,100),generalEmail:optional(input.generalEmail,320),address:jsonObject(input.address),serviceArea:optional(input.serviceArea,500),estimatedFleetSize:input.estimatedFleetSize==null?null:bounded(input.estimatedFleetSize,0,100000,0),vehicleTypes:stringArray(input.vehicleTypes),source:optional(input.source,100)||'manual',sourceUrl:optional(input.sourceUrl,1000),stage,qualificationScore:bounded(input.qualificationScore,0,100,0),opportunityValue:input.opportunityValue==null?null:String(Math.max(0,Number(input.opportunityValue)||0).toFixed(2)),probability:bounded(input.probability,0,100,0),notes:optional(input.notes,10000),metadata:jsonObject(input.metadata),
  }).returning();return row;
 }
 async update(organizationId:string,id:string,input:Record<string,unknown>){
  await this.get(organizationId,id);const stage=input.stage===undefined?undefined:String(input.stage);if(stage&&!STAGES.has(stage))throw new Error('Invalid prospect stage');
  const [row]=await database().update(prospects).set({
   ...(input.companyName!==undefined?{companyName:required(input.companyName,'Company name',300)}:{}),...(input.website!==undefined?{website:cleanWebsite(input.website)}:{}),...(input.industry!==undefined?{industry:optional(input.industry,200)}:{}),...(input.phone!==undefined?{phone:optional(input.phone,100)}:{}),...(input.generalEmail!==undefined?{generalEmail:optional(input.generalEmail,320)}:{}),...(input.address!==undefined?{address:jsonObject(input.address)}:{}),...(input.serviceArea!==undefined?{serviceArea:optional(input.serviceArea,500)}:{}),...(input.estimatedFleetSize!==undefined?{estimatedFleetSize:input.estimatedFleetSize==null?null:bounded(input.estimatedFleetSize,0,100000,0)}:{}),...(input.vehicleTypes!==undefined?{vehicleTypes:stringArray(input.vehicleTypes)}:{}),...(stage?{stage}:{}),...(input.qualificationScore!==undefined?{qualificationScore:bounded(input.qualificationScore,0,100,0)}:{}),...(input.nextFollowUpAt!==undefined?{nextFollowUpAt:input.nextFollowUpAt?new Date(String(input.nextFollowUpAt)):null}:{}),...(input.opportunityValue!==undefined?{opportunityValue:input.opportunityValue==null?null:String(Math.max(0,Number(input.opportunityValue)||0).toFixed(2))}:{}),...(input.probability!==undefined?{probability:bounded(input.probability,0,100,0)}:{}),...(input.lostReason!==undefined?{lostReason:optional(input.lostReason,2000)}:{}),...(input.notes!==undefined?{notes:optional(input.notes,10000)}:{}),updatedAt:new Date(),
  }).where(and(eq(prospects.organizationId,organizationId),eq(prospects.id,id))).returning();return row;
 }
 async addContact(organizationId:string,prospectId:string,input:Record<string,unknown>){
  await this.get(organizationId,prospectId);const [row]=await database().insert(prospectContacts).values({id:randomUUID(),organizationId,prospectId,name:required(input.name,'Contact name',300),email:optional(input.email,320),phone:optional(input.phone,100),title:optional(input.title,200),isDecisionMaker:input.isDecisionMaker===true,sourceUrl:optional(input.sourceUrl,1000),confidence:bounded(input.confidence,0,100,0),notes:optional(input.notes,5000)}).returning();return row;
 }
 async addActivity(organizationId:string,prospectId:string,input:Record<string,unknown>){
  await this.get(organizationId,prospectId);const [row]=await database().insert(prospectActivities).values({id:randomUUID(),organizationId,prospectId,kind:required(input.kind,'Activity kind',100),direction:optional(input.direction,30),channel:optional(input.channel,50),subject:optional(input.subject,1000),summary:optional(input.summary,10000),externalMessageId:optional(input.externalMessageId,300),occurredAt:input.occurredAt?new Date(String(input.occurredAt)):new Date(),metadata:jsonObject(input.metadata)}).returning();return row;
 }
 async research(organizationId:string,prospectId:string){
  const detail=await this.get(organizationId,prospectId);const website=detail.prospect.website;if(!website)throw new Error('Prospect website is required for research');
  await database().update(prospects).set({stage:detail.prospect.stage==='new'?'researching':detail.prospect.stage,updatedAt:new Date()}).where(and(eq(prospects.organizationId,organizationId),eq(prospects.id,prospectId)));
  const crawled=await crawlWebsite(website);const evidence=crawled.pages.slice(0,8).map(p=>({url:p.url,title:p.title,content:p.content.slice(0,6000)}));
  const prompt=`Analyze this company's public website for B2B fleet-service prospecting. Use only the supplied evidence. Return valid JSON with keys: summary (string), industry (string|null), estimatedFleetSize (integer|null), vehicleTypes (string[]), serviceArea (string|null), fleetEvidence (array of concise evidence strings), qualificationScore (0-100 integer), qualificationReason (string). Do not invent fleet size; use null when unsupported.\nCompany: ${detail.prospect.companyName}\nEvidence: ${JSON.stringify(evidence)}`;
  const ai=await callAICompletion([{role:'user',content:prompt}],'You extract grounded fleet-sales intelligence from supplied public website evidence. Output JSON only.');
  let parsed:any={};try{parsed=JSON.parse(ai.content.replace(/^```json\s*/,'').replace(/\s*```$/,''));}catch{parsed={summary:ai.content.slice(0,5000),qualificationScore:0,fleetEvidence:[]};}
  const sources=evidence.map(p=>({url:p.url,title:p.title}));
  const [updated]=await database().update(prospects).set({researchSummary:optional(parsed.summary,10000),industry:optional(parsed.industry,200)??detail.prospect.industry,estimatedFleetSize:parsed.estimatedFleetSize==null?detail.prospect.estimatedFleetSize:bounded(parsed.estimatedFleetSize,0,100000,0),vehicleTypes:stringArray(parsed.vehicleTypes),serviceArea:optional(parsed.serviceArea,500)??detail.prospect.serviceArea,fleetEvidence:Array.isArray(parsed.fleetEvidence)?parsed.fleetEvidence.slice(0,30):[],researchSources:sources,lastResearchedAt:new Date(),qualificationScore:bounded(parsed.qualificationScore,0,100,0),metadata:{...(detail.prospect.metadata as Record<string,unknown>),qualificationReason:optional(parsed.qualificationReason,5000)},stage:detail.prospect.stage==='new'||detail.prospect.stage==='researching'?'qualified':detail.prospect.stage,updatedAt:new Date()}).where(and(eq(prospects.organizationId,organizationId),eq(prospects.id,prospectId))).returning();
  await this.addActivity(organizationId,prospectId,{kind:'research',channel:'firecrawl',summary:`Researched ${sources.length} public pages. Qualification score: ${updated.qualificationScore}.`,metadata:{sources}});return updated;
 }
 async convertToFleetAccount(organizationId:string,prospectId:string){
  const url=process.env.DATABASE_URL||process.env.NEON_DATABASE_URL;if(!url)throw new Error('Database is not configured');const pool=new Pool({connectionString:url});const client=await pool.connect();
  try{await client.query('BEGIN');const result=await client.query('SELECT * FROM public.prospects WHERE organization_id=$1 AND id=$2 FOR UPDATE',[organizationId,prospectId]);const prospect=result.rows[0];if(!prospect)throw new Error('Prospect not found');if(prospect.converted_customer_id){await client.query('COMMIT');return {customerId:prospect.converted_customer_id,alreadyConverted:true};}
   const customerId=randomUUID();await client.query(`INSERT INTO public.customers(id,organization_id,name,primary_contact_name,primary_contact_email,billing_email,phone,status,notes) VALUES($1,$2,$3,$4,$5,$5,$6,'active',$7)`,[customerId,organizationId,prospect.company_name,null,prospect.general_email,prospect.phone,prospect.notes]);
   const contacts=await client.query('SELECT * FROM public.prospect_contacts WHERE organization_id=$1 AND prospect_id=$2 ORDER BY is_decision_maker DESC, created_at',[organizationId,prospectId]);for(const contact of contacts.rows){await client.query(`INSERT INTO public.contacts(id,organization_id,customer_id,name,email,phone,role,is_primary,tags,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[randomUUID(),organizationId,customerId,contact.name,contact.email,contact.phone,contact.title,Boolean(contact.is_decision_maker),['converted_prospect'],contact.notes]);}
   await client.query(`UPDATE public.prospects SET stage='converted',converted_customer_id=$1,converted_at=now(),updated_at=now() WHERE organization_id=$2 AND id=$3`,[customerId,organizationId,prospectId]);await client.query(`INSERT INTO public.prospect_activities(id,organization_id,prospect_id,kind,channel,summary,occurred_at,metadata) VALUES($1,$2,$3,'conversion','fleet_os',$4,now(),$5::jsonb)`,[randomUUID(),organizationId,prospectId,`Converted ${prospect.company_name} to Fleet Account`,JSON.stringify({customerId})]);await client.query('COMMIT');return {customerId,alreadyConverted:false};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
 }
}
export const prospectingService=new ProspectingService();
