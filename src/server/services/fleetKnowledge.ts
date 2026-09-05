import { desc, eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { auditEvents, contacts, customers, organizationMemberships, technicians, users, vehicles, workOrders } from '../../db/drizzleSchema.js';
import { prospectContacts, prospects } from '../../db/prospectSchema.js';

type KnowledgeRecord = { kind:string; id:string; label:string; aliases:string[]; data:Record<string,unknown> };
type Snapshot = { loadedAt:string; counts:Record<string,number>; records:KnowledgeRecord[]; recentChanges:Record<string,unknown>[] };
type CacheEntry = { expiresAt:number; invalidated:boolean; snapshot:Snapshot };

const cache = new Map<string,CacheEntry>();
const TTL_MS = 60_000;
const STOP = new Set(['the','and','for','with','that','this','from','about','what','who','where','when','find','show','look','search','email','emails','contact','contacts','prospect','prospects','customer','customers','fleet','please','tell','have','has','had','can','could','would','should','there','their','them','they','into','your','you','our','his','her','its','are','was','were','been','know','does','database','data']);

function normalize(value:unknown){return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9@._+-]+/g,' ').trim();}
function terms(input:string){return [...new Set(normalize(input).split(/\s+/).filter(v=>v.length>=3&&!STOP.has(v)))].slice(0,10);}
function distance(a:string,b:string){const prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let left=i,diag=i-1;for(let j=1;j<=b.length;j++){const up=prev[j];const next=Math.min(up+1,left+1,diag+(a[i-1]===b[j-1]?0:1));prev[j-1]=left;diag=up;left=next;}prev[b.length]=left;}return prev[b.length];}
function similarity(a:string,b:string){const x=normalize(a),y=normalize(b);if(!x||!y)return 0;if(x===y)return 1;if(x.includes(y)||y.includes(x))return .94;return 1-distance(x,y)/Math.max(x.length,y.length);}
function score(record:KnowledgeRecord,queryTerms:string[]){if(!queryTerms.length)return 0;const values=[record.label,...record.aliases].map(normalize).filter(Boolean);let total=0;for(const term of queryTerms){let best=0;for(const value of values){best=Math.max(best,similarity(term,value));for(const token of value.split(/\s+/))best=Math.max(best,similarity(term,token));}if(best>=.58)total+=best;}return total/queryTerms.length;}
function rec(kind:string,id:string,label:unknown,aliases:unknown[],data:Record<string,unknown>):KnowledgeRecord{return{kind,id,label:String(label||id),aliases:aliases.map(v=>String(v??'')).filter(Boolean),data};}

export function invalidateFleetKnowledge(organizationId:string){const entry=cache.get(organizationId);if(entry)entry.invalidated=true;}

async function load(organizationId:string):Promise<Snapshot>{
 const db=getDb();if(!db)throw new Error('Production database is not configured');
 const [accounts,contactRows,prospectRows,prospectContactRows,members,techRows,vehicleRows,workOrderRows,changes]=await Promise.all([
  db.select().from(customers).where(eq(customers.organizationId,organizationId)).limit(300),
  db.select().from(contacts).where(eq(contacts.organizationId,organizationId)).limit(600),
  db.select().from(prospects).where(eq(prospects.organizationId,organizationId)).limit(300),
  db.select().from(prospectContacts).where(eq(prospectContacts.organizationId,organizationId)).limit(600),
  db.select({id:users.id,name:users.name,email:users.email,role:organizationMemberships.role,status:organizationMemberships.status}).from(organizationMemberships).innerJoin(users,eq(users.id,organizationMemberships.userId)).where(eq(organizationMemberships.organizationId,organizationId)).limit(300),
  db.select().from(technicians).where(eq(technicians.organizationId,organizationId)).limit(300),
  db.select().from(vehicles).where(eq(vehicles.organizationId,organizationId)).limit(800),
  db.select().from(workOrders).where(eq(workOrders.organizationId,organizationId)).orderBy(desc(workOrders.updatedAt)).limit(400),
  db.select({eventType:auditEvents.eventType,entityType:auditEvents.entityType,entityId:auditEvents.entityId,payload:auditEvents.payload,occurredAt:auditEvents.occurredAt}).from(auditEvents).where(eq(auditEvents.organizationId,organizationId)).orderBy(desc(auditEvents.occurredAt)).limit(50),
 ]);
 const records:KnowledgeRecord[]=[
  ...accounts.map(r=>rec('fleet_account',r.id,r.name,[r.accountNumber,r.primaryContactName,r.primaryContactEmail,r.billingContactName,r.billingEmail,r.phone],{accountNumber:r.accountNumber,status:r.status,primaryContactName:r.primaryContactName,primaryContactEmail:r.primaryContactEmail})),
  ...contactRows.map(r=>rec('contact',r.id,r.name,[r.email,r.phone,r.role],{customerId:r.customerId,email:r.email,phone:r.phone,role:r.role,isPrimary:r.isPrimary})),
  ...prospectRows.map(r=>rec('prospect',r.id,r.companyName,[r.generalEmail,r.phone,r.industry,r.serviceArea],{stage:r.stage,qualificationScore:r.qualificationScore,nextFollowUpAt:r.nextFollowUpAt,researchSummary:r.researchSummary})),
  ...prospectContactRows.map(r=>rec('prospect_contact',r.id,r.name,[r.email,r.phone,r.title],{prospectId:r.prospectId,email:r.email,phone:r.phone,title:r.title,isDecisionMaker:r.isDecisionMaker})),
  ...members.map(r=>rec('team_member',r.id,r.name,[r.email,r.role],{email:r.email,role:r.role,status:r.status})),
  ...techRows.map(r=>rec('technician',r.id,r.name,[r.phone,...(r.skills||[])],{userId:r.userId,phone:r.phone,skills:r.skills,active:r.active})),
  ...vehicleRows.map(r=>rec('vehicle',r.id,r.unitNumber,[r.vin,r.make,r.model,r.assignedDriver,r.department,r.licensePlate],{customerId:r.customerId,unitNumber:r.unitNumber,vin:r.vin,year:r.year,make:r.make,model:r.model,engine:r.engine,mileage:r.mileage,engineHours:r.engineHours,status:r.status,assignedDriver:r.assignedDriver})),
  ...workOrderRows.map(r=>rec('work_order',r.id,r.number,[r.complaint,r.diagnosis,r.purchaseOrderNumber,r.status],{customerId:r.customerId,vehicleId:r.vehicleId,status:r.status,priority:r.priority,scheduledAt:r.scheduledAt,complaint:r.complaint,diagnosis:r.diagnosis,requestedServices:r.requestedServices})),
 ];
 return{loadedAt:new Date().toISOString(),counts:{fleetAccounts:accounts.length,contacts:contactRows.length,prospects:prospectRows.length,prospectContacts:prospectContactRows.length,teamMembers:members.length,technicians:techRows.length,vehicles:vehicleRows.length,workOrders:workOrderRows.length},records,recentChanges:changes};
}

async function snapshot(organizationId:string){const found=cache.get(organizationId);if(found&&!found.invalidated&&found.expiresAt>Date.now())return{snapshot:found.snapshot,cache:'hit' as const};const next=await load(organizationId);cache.set(organizationId,{expiresAt:Date.now()+TTL_MS,invalidated:false,snapshot:next});return{snapshot:next,cache:'refresh' as const};}

export async function getFleetKnowledgeContext(organizationId:string,userText:string){const state=await snapshot(organizationId);const queryTerms=terms(userText);const matches=state.snapshot.records.map(record=>({record,score:score(record,queryTerms)})).filter(item=>item.score>=.58).sort((a,b)=>b.score-a.score).slice(0,20).map(item=>({...item.record,matchScore:Number(item.score.toFixed(3))}));return{source:'fleet_knowledge_layer',cache:state.cache,loadedAt:state.snapshot.loadedAt,counts:state.snapshot.counts,queryTerms,matches,recentChanges:state.snapshot.recentChanges.slice(0,12)};}
