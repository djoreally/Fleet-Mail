import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { prospectContacts, prospects } from '../../db/prospectSchema.js';
import { callAICompletion } from './ai.js';
import { searchWeb } from './firecrawl.js';
import { prospectingService } from './prospecting.js';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const GENERAL_LOCAL_PARTS = new Set(['info','hello','contact','office','sales','service','support','fleet','dispatch','admin']);
const clean=(value:unknown,max=1000)=>String(value??'').trim().slice(0,max);
const normalizeEmail=(value:unknown)=>clean(value,320).toLowerCase();
const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function evidenceEmails(text:string){
  return Array.from(new Set((text.match(EMAIL_RE)||[]).map(email=>email.toLowerCase()))).slice(0,40);
}

function emailDomain(email:string){return (email.split('@')[1]||'').toLowerCase().replace(/^www\./i,'');}
function companyDomainEmail(email:string,hostname:string){const domain=emailDomain(email);return domain===hostname||domain.endsWith(`.${hostname}`);}
function generalAddress(emails:string[],hostname:string){
  return emails.find(email=>companyDomainEmail(email,hostname)&&GENERAL_LOCAL_PARTS.has(email.split('@')[0]||''))||null;
}

function safeJson(content:string){
  try{return JSON.parse(content.replace(/^```json\s*/i,'').replace(/\s*```$/,''));}catch{return null;}
}

export class ProspectContactDiscoveryService {
  async enrich(organizationId:string, prospectId:string){
    const db=getDb();
    if(!db)throw new Error('Database is not configured');
    const detail=await prospectingService.get(organizationId,prospectId);
    const prospect=detail.prospect;
    if(!prospect.website)return {found:0,generalEmail:prospect.generalEmail||null,contacts:[],sources:[],warning:'Prospect website is required for contact discovery'};

    let hostname='';
    try{hostname=new URL(prospect.website).hostname.replace(/^www\./i,'');}catch{return {found:0,generalEmail:prospect.generalEmail||null,contacts:[],sources:[],warning:'Prospect website is invalid'};}
    const query=`\"${prospect.companyName}\" site:${hostname} contact email owner operations fleet service manager`;
    let results:Awaited<ReturnType<typeof searchWeb>>=[];
    try{results=await searchWeb(query,{limit:10,location:prospect.serviceArea||undefined});}
    catch(error){return {found:0,generalEmail:prospect.generalEmail||null,contacts:[],sources:[],warning:error instanceof Error?error.message:'Contact research failed'};}

    const evidence=results.map((item,index)=>({index,url:item.url,title:item.title,description:item.description,content:item.content.slice(0,8000)}));
    const evidenceText=evidence.map(item=>`${item.title}\n${item.description}\n${item.content}`).join('\n').toLowerCase();
    const supportedEmails=evidenceEmails(evidenceText);
    const supportedSet=new Set(supportedEmails);
    const sources=evidence.map(item=>({url:item.url,title:item.title}));
    let parsed:any=null;

    if(evidence.length){
      try{
        const prompt=`Identify public business contact information from the supplied evidence for fleet-service outreach. Use only the evidence. Never invent an email, person, title, phone number, or relationship. Return JSON only: {"generalEmail":string|null,"contacts":[{"name":string,"email":string,"title":string|null,"isDecisionMaker":boolean,"confidence":number,"sourceIndex":number}]}. Include a contact only when the exact email address appears in the evidence. Prefer owner, operations, fleet, facilities, service, office, or management contacts.\nCompany: ${prospect.companyName}\nWebsite: ${prospect.website}\nEvidence: ${JSON.stringify(evidence)}`;
        const ai=await callAICompletion([{role:'user',content:prompt}],'You extract only evidence-supported public B2B contact information. Output JSON only.');
        parsed=safeJson(ai.content);
      }catch(error){
        console.warn('Prospect contact AI enrichment failed; retaining deterministic email discovery.',error instanceof Error?error.message:error);
      }
    }

    const requestedGeneral=normalizeEmail(parsed?.generalEmail);
    const deterministicGeneral=generalAddress(supportedEmails,hostname);
    const generalEmail=(validEmail(requestedGeneral)&&supportedSet.has(requestedGeneral)?requestedGeneral:null)||deterministicGeneral||prospect.generalEmail||null;
    if(generalEmail&&generalEmail!==prospect.generalEmail){
      await db.update(prospects).set({generalEmail,updatedAt:new Date(),metadata:{...(prospect.metadata as Record<string,unknown>),contactDiscovery:{source:'firecrawl_search',query,sourceCount:sources.length,lastRunAt:new Date().toISOString()}}}).where(and(eq(prospects.organizationId,organizationId),eq(prospects.id,prospectId)));
    }

    const candidates=Array.isArray(parsed?.contacts)?parsed.contacts.slice(0,12):[];
    const persisted=[] as Array<{id:string;name:string;email:string|null;title:string|null;isDecisionMaker:boolean}>;
    const existingByEmail=new Map(detail.contacts.filter(item=>item.email).map(item=>[String(item.email).toLowerCase(),item]));
    for(const candidate of candidates){
      const email=normalizeEmail(candidate?.email);
      if(!validEmail(email)||!supportedSet.has(email))continue;
      const name=clean(candidate?.name,300);
      if(!name)continue;
      const source=evidence[Number(candidate?.sourceIndex)]||evidence.find(item=>`${item.title}\n${item.description}\n${item.content}`.toLowerCase().includes(email));
      const title=clean(candidate?.title,200)||null;
      const confidence=Math.max(0,Math.min(100,Math.round(Number(candidate?.confidence)||0)));
      const isDecisionMaker=Boolean(candidate?.isDecisionMaker);
      const existing=existingByEmail.get(email);
      if(existing){
        const [updated]=await db.update(prospectContacts).set({name,title,email,isDecisionMaker,confidence,sourceUrl:source?.url||existing.sourceUrl,updatedAt:new Date()}).where(and(eq(prospectContacts.organizationId,organizationId),eq(prospectContacts.id,existing.id))).returning();
        if(updated)persisted.push(updated);
      }else{
        const [created]=await db.insert(prospectContacts).values({id:randomUUID(),organizationId,prospectId,name,email,title,isDecisionMaker,confidence,sourceUrl:source?.url||prospect.website,notes:'Public contact discovered from evidence-backed prospect research.'}).returning();
        if(created){persisted.push(created);existingByEmail.set(email,created);}
      }
    }

    if(generalEmail||persisted.length){
      await prospectingService.addActivity(organizationId,prospectId,{kind:'contact_research',channel:'firecrawl',summary:`Contact research found ${persisted.length} named contact${persisted.length===1?'':'s'}${generalEmail?' and a usable public email':''}.`,metadata:{query,sources,generalEmail,contactIds:persisted.map(item=>item.id)}});
    }

    return {found:persisted.length,generalEmail,contacts:persisted,sources,warning:null};
  }
}

export const prospectContactDiscoveryService=new ProspectContactDiscoveryService();
