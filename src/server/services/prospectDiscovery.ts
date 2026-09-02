import { callAICompletion } from './ai.js';
import { searchWeb } from './firecrawl.js';

const clean=(value:unknown,max=500)=>String(value??'').trim().slice(0,max);

export class ProspectDiscoveryService {
 async discover(input:Record<string,unknown>){
  const industry=clean(input.industry,120);const location=clean(input.location,200);const keywords=clean(input.keywords,200);
  if(!industry&&!keywords)throw new Error('Industry or prospect keywords are required');
  const limit=Math.min(20,Math.max(1,Number(input.limit)||10));
  const query=[industry||keywords,location,keywords&&industry?keywords:'','company fleet vehicles service vans trucks'].filter(Boolean).join(' ');
  const results=await searchWeb(query,{limit:Math.min(20,limit*2),location:location||undefined});
  if(!results.length)return {query,candidates:[]};
  const evidence=results.map((item,index)=>({index,url:item.url,title:item.title,description:item.description,content:item.content.slice(0,5000)}));
  const prompt=`Identify legitimate B2B fleet-service prospect companies from these Firecrawl search results. Use only supplied evidence. Exclude directories, news articles, social profiles, marketplaces, government pages, and companies with no evidence of operating field/service/commercial vehicles. Never invent fleet size. Return JSON only: {"candidates":[{"companyName":string,"website":string,"industry":string|null,"serviceArea":string|null,"estimatedFleetSize":number|null,"vehicleTypes":string[],"fleetEvidence":string[],"qualificationScore":number,"sourceIndexes":number[]}]}. Return at most ${limit} candidates.\nSearch: ${query}\nEvidence: ${JSON.stringify(evidence)}`;
  const ai=await callAICompletion([{role:'user',content:prompt}],'You qualify B2B fleet prospects using only supplied Firecrawl evidence. Output JSON only.');
  let parsed:any;try{parsed=JSON.parse(ai.content.replace(/^```json\s*/,'').replace(/\s*```$/,''));}catch{throw new Error('Prospect discovery could not be structured safely');}
  const candidates=Array.isArray(parsed?.candidates)?parsed.candidates.slice(0,limit):[];
  return {query,candidates:candidates.map((candidate:any)=>({
    companyName:clean(candidate.companyName,300),website:clean(candidate.website,1000),industry:clean(candidate.industry,200)||null,serviceArea:clean(candidate.serviceArea,500)||null,
    estimatedFleetSize:Number.isFinite(Number(candidate.estimatedFleetSize))?Math.max(0,Math.round(Number(candidate.estimatedFleetSize))):null,
    vehicleTypes:Array.isArray(candidate.vehicleTypes)?candidate.vehicleTypes.slice(0,20).map((v:unknown)=>clean(v,100)).filter(Boolean):[],
    fleetEvidence:Array.isArray(candidate.fleetEvidence)?candidate.fleetEvidence.slice(0,20).map((v:unknown)=>clean(v,1000)).filter(Boolean):[],qualificationScore:Math.min(100,Math.max(0,Math.round(Number(candidate.qualificationScore)||0))),
    sources:(Array.isArray(candidate.sourceIndexes)?candidate.sourceIndexes:[]).map((i:unknown)=>evidence[Number(i)]).filter(Boolean).map((source:any)=>({url:source.url,title:source.title})),
  })).filter((candidate:any)=>candidate.companyName&&/^https:\/\//i.test(candidate.website))};
 }
}
export const prospectDiscoveryService=new ProspectDiscoveryService();