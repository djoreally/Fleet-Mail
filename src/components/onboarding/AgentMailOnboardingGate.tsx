import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Mail, RefreshCw } from 'lucide-react';
import { fleetFetch } from '../../lib/fleetApi';

export const PENDING_AGENTMAIL_ONBOARDING_KEY='fleetmail.pendingAgentMailOnboarding';

type Status={ready:boolean;mode:'legacy'|'tenant';organizationName:string;inboxAddress:string|null;status:string;role:string;canProvision:boolean};
type Pending={businessName:string;inboxUsername:string};

async function jsonRequest<T>(path:string,init?:RequestInit):Promise<T>{
 const response=await fleetFetch(path,{...init,headers:{'Content-Type':'application/json',...(init?.headers||{})}});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(body.error||`Request failed (${response.status})`);
 return body as T;
}
function slug(value:string){return value.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,63);}

export function AgentMailOnboardingGate({children}:{children:ReactNode}){
 const[status,setStatus]=useState<Status|null>(null),[businessName,setBusinessName]=useState(''),[inboxUsername,setInboxUsername]=useState(''),[error,setError]=useState(''),[working,setWorking]=useState(false);
 const autoAttempted=useRef(false);

 async function load(){
  setError('');
  try{
   const next=await jsonRequest<Status>('/api/agentmail/onboarding/status');
   setStatus(next);
   if(!businessName)setBusinessName(next.organizationName||'');
   if(next.ready){localStorage.removeItem(PENDING_AGENTMAIL_ONBOARDING_KEY);return;}
   const raw=localStorage.getItem(PENDING_AGENTMAIL_ONBOARDING_KEY);
   if(raw&&!autoAttempted.current&&next.canProvision){
    autoAttempted.current=true;
    try{
     const pending=JSON.parse(raw) as Pending;
     setBusinessName(pending.businessName||next.organizationName||'');
     setInboxUsername(pending.inboxUsername||'');
     await provision(pending.businessName,pending.inboxUsername);
    }catch{localStorage.removeItem(PENDING_AGENTMAIL_ONBOARDING_KEY);}
   }
  }catch(reason){setError(reason instanceof Error?reason.message:'Fleet inbox setup could not be loaded');}
 }
 useEffect(()=>{void load()},[]);

 async function provision(name=businessName,username=inboxUsername){
  const cleanName=name.trim();const cleanUsername=slug(username);
  if(!cleanName)return setError('Business name is required.');
  if(!/^[a-z0-9][a-z0-9._-]{1,62}$/i.test(cleanUsername))return setError('Choose an inbox name with 2–63 letters, numbers, dots, dashes, or underscores.');
  setWorking(true);setError('');
  try{
   const result=await jsonRequest<Status>('/api/agentmail/onboarding/provision',{method:'POST',body:JSON.stringify({businessName:cleanName,inboxUsername:cleanUsername})});
   localStorage.removeItem(PENDING_AGENTMAIL_ONBOARDING_KEY);setStatus({...result,role:status?.role||'owner',canProvision:true});
  }catch(reason){setError(reason instanceof Error?reason.message:'Fleet inbox setup failed');}
  finally{setWorking(false);}
 }

 if(status?.ready)return <>{children}</>;
 if(!status&&!error)return <main className="grid min-h-screen place-items-center bg-[#07101f] px-4 text-white"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300"/><p className="mt-4 text-sm text-slate-400">Preparing your Fleetmail workspace…</p></div></main>;

 return <main className="min-h-screen bg-[#07101f] px-4 py-10 text-white"><div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl sm:p-8">
  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-300"><Mail className="h-6 w-6"/></div>
  <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Fleet inbox setup</p>
  <h1 className="mt-2 text-2xl font-bold">Create your dedicated AgentMail workspace</h1>
  <p className="mt-2 text-sm leading-6 text-slate-400">Fleetmail creates a private AgentMail Pod, inbox, scoped credential, and webhook for this organization. Your team members will use this same workspace.</p>
  {error&&<div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
  {!status?.canProvision&&status?<div className="mt-6 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">An owner or admin needs to finish the Fleet inbox setup before this workspace can be used.</div>:<div className="mt-6 space-y-4">
   <label className="block"><span className="text-xs font-bold text-slate-300">Business name</span><input value={businessName} onChange={e=>{setBusinessName(e.target.value);if(!inboxUsername)setInboxUsername(slug(e.target.value))}} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-4 outline-none focus:border-cyan-300" placeholder="Acme Fleet Services"/></label>
   <label className="block"><span className="text-xs font-bold text-slate-300">Fleet inbox name</span><div className="mt-2 flex min-h-12 overflow-hidden rounded-xl border border-white/10 bg-slate-950 focus-within:border-cyan-300"><input value={inboxUsername} onChange={e=>setInboxUsername(slug(e.target.value))} className="min-w-0 flex-1 bg-transparent px-4 outline-none" placeholder="acmefleet"/><span className="flex items-center border-l border-white/10 px-3 text-sm text-slate-500">@agentmail.to</span></div></label>
   <button disabled={working} onClick={()=>void provision()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 font-bold text-slate-950 disabled:opacity-50">{working?<><RefreshCw className="h-4 w-4 animate-spin"/>Creating Pod & inbox…</>:<><CheckCircle2 className="h-4 w-4"/>Set up Fleet inbox</>}</button>
  </div>}
  <p className="mt-5 text-xs leading-5 text-slate-500">AgentMail credentials stay server-side. Fleetmail never asks customers to paste an AgentMail API key.</p>
 </div></main>;
}
