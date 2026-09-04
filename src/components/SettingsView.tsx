import React, { useEffect, useState } from 'react';
import { Bell, Bot, Building2, Calendar, Check, Globe2, Mail, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import type { PersonalizationSettings } from '../types';

interface SettingsViewProps {
  settings: PersonalizationSettings;
  onSaveSettings: (newSettings: PersonalizationSettings) => void;
  onCancel?: () => void;
}

const DEFAULT_BUSINESS = {
  businessName: '', businessEmail: '', businessPhone: '', website: '', address: '', city: '', region: '', postalCode: '', timezone: 'America/New_York'
};
const DEFAULT_AGENT = { allowWebResearch: true, allowNhtsaVinDecode: true, allowCameraOcr: true, requireConfirmationForWrites: true };

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSaveSettings, onCancel }) => {
  const [draft, setDraft] = useState<PersonalizationSettings>({
    ...settings,
    businessProfile: settings.businessProfile || DEFAULT_BUSINESS,
    agentPreferences: settings.agentPreferences || DEFAULT_AGENT,
  });
  const [saved, setSaved] = useState(false);
  const [google, setGoogle] = useState<{configured:boolean;connected:boolean;account?:{email:string;name?:string}} | null>(null);
  const [googleBusy,setGoogleBusy]=useState(false);
  useEffect(()=>setDraft({...settings,businessProfile:settings.businessProfile||DEFAULT_BUSINESS,agentPreferences:settings.agentPreferences||DEFAULT_AGENT}),[settings]);
  const loadGoogle=async()=>{try{const r=await fetch('/api/google/status');setGoogle(await r.json());}catch{setGoogle({configured:false,connected:false});}};
  useEffect(()=>{void loadGoogle();},[]);
  const setBusiness=(key:string,value:string)=>setDraft(current=>({...current,businessProfile:{...(current.businessProfile||DEFAULT_BUSINESS),[key]:value}}));
  const setAgent=(key:string,value:boolean)=>setDraft(current=>({...current,agentPreferences:{...(current.agentPreferences||DEFAULT_AGENT),[key]:value}}));
  const save=()=>{onSaveSettings(draft);try{localStorage.setItem('fleetos:user-settings',JSON.stringify(draft));}catch{}setSaved(true);setTimeout(()=>setSaved(false),2200);};
  const disconnectGoogle=async()=>{setGoogleBusy(true);try{await fetch('/api/google/disconnect',{method:'POST'});await loadGoogle();}finally{setGoogleBusy(false);}};

  return <div className="flex-1 overflow-y-auto bg-slate-50/60">
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div><h1 className="text-2xl font-bold text-slate-900">Settings</h1><p className="mt-1 text-sm text-slate-500">Business profile, connected services, notifications, and Fleet Agent preferences.</p></div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Building2 className="h-5 w-5"/></div><div><h2 className="font-bold text-slate-900">Business profile</h2><p className="text-xs text-slate-500">Used across Fleet OS communications and agent context.</p></div></div>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ['businessName','Business name','MOMS Mobile Oil Change'],['businessEmail','Business email','service@example.com'],['businessPhone','Business phone','(555) 555-0100'],['website','Website','https://example.com'],['address','Street address','123 Main St'],['city','City','Ambler'],['region','State / region','PA'],['postalCode','ZIP / postal code','19002']
          ].map(([key,label,placeholder])=><label key={key} className="space-y-1.5 text-sm font-medium text-slate-700"><span>{label}</span><input value={(draft.businessProfile as any)?.[key]||''} onChange={e=>setBusiness(key,e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></label>)}
          <label className="space-y-1.5 text-sm font-medium text-slate-700 md:col-span-2"><span>Timezone</span><select value={draft.businessProfile?.timezone||'America/New_York'} onChange={e=>setBusiness('timezone',e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm"><option value="America/New_York">Eastern Time</option><option value="America/Chicago">Central Time</option><option value="America/Denver">Mountain Time</option><option value="America/Los_Angeles">Pacific Time</option></select></label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><Bot className="h-5 w-5"/></div><div><h2 className="font-bold text-slate-900">Fleet Agent</h2><p className="text-xs text-slate-500">Controls what the agent may read and how it behaves. Consequential writes remain confirmation-gated.</p></div></div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4"><div className="mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-blue-600"/><span className="text-sm font-semibold">Response style</span></div><div className="grid grid-cols-3 gap-2">{(['Professional','Friendly','Concise'] as const).map(tone=><button key={tone} type="button" onClick={()=>setDraft(c=>({...c,personalityFocus:tone}))} className={`rounded-lg px-3 py-2 text-xs font-semibold ${draft.personalityFocus===tone?'bg-blue-600 text-white':'bg-slate-100 text-slate-700'}`}>{tone}</button>)}</div></div>
          <Toggle label="Web research" detail="Allow Browserbase research for public company and prospect information." checked={draft.agentPreferences?.allowWebResearch??true} onChange={v=>setAgent('allowWebResearch',v)} icon={<Globe2 className="h-4 w-4"/>}/>
          <Toggle label="NHTSA VIN decoding" detail="Allow the agent to decode VINs with NHTSA vPIC vehicle data." checked={draft.agentPreferences?.allowNhtsaVinDecode??true} onChange={v=>setAgent('allowNhtsaVinDecode',v)} icon={<ShieldCheck className="h-4 w-4"/>}/>
          <Toggle label="Camera & OCR" detail="Allow camera scans and image text extraction for cards, documents and vehicles." checked={draft.agentPreferences?.allowCameraOcr??true} onChange={v=>setAgent('allowCameraOcr',v)} icon={<MapPin className="h-4 w-4"/>}/>
          <Toggle label="Require confirmation for writes" detail="Email sends, scheduling, account changes and other mutations require review." checked={draft.agentPreferences?.requireConfirmationForWrites??true} onChange={v=>setAgent('requireConfirmationForWrites',v)} icon={<ShieldCheck className="h-4 w-4"/>}/>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3"><Mail className="h-5 w-5 text-blue-600"/><div><h2 className="font-bold text-slate-900">Connected services</h2><p className="text-xs text-slate-500">Email and calendar connections used by Fleet OS.</p></div></div>
        <div className="divide-y divide-slate-100">
          <div className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-semibold">AgentMail</p><p className="text-xs text-slate-500">{settings.connectedAccounts.find(a=>a.type==='agentmail')?.email||'Organization inbox'}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Connected</span></div>
          <div className="flex items-center justify-between gap-4 py-3"><div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-slate-500"/><div><p className="text-sm font-semibold">Google Workspace</p><p className="text-xs text-slate-500">{google?.connected?`${google.account?.email||'Google'} · Gmail + Calendar`:'Connect Gmail and Google Calendar'}</p></div></div>{google?.connected?<button disabled={googleBusy} onClick={()=>void disconnectGoogle()} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Disconnect</button>:<a href="/api/google/oauth/start" className={`rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white ${!google?.configured?'pointer-events-none opacity-50':''}`}>Connect</a>}</div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2"><Bell className="h-5 w-5 text-blue-600"/><h2 className="font-bold text-slate-900">Notifications</h2></div>
        <div className="grid gap-4 md:grid-cols-2"><Toggle label="Important emails only" detail="Reduce non-essential Fleet Inbox notifications." checked={draft.importantEmailsOnly} onChange={v=>setDraft(c=>({...c,importantEmailsOnly:v}))}/><Toggle label="Daily AI digest" detail="Receive a morning Fleet OS summary." checked={draft.dailyAIDigest} onChange={v=>setDraft(c=>({...c,dailyAIDigest:v}))}/></div>
      </section>

      <div className="flex justify-end gap-3 pb-8"><button onClick={onCancel} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button onClick={save} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Save changes</button></div>
    </div>
    {saved&&<div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl"><Check className="h-4 w-4 text-emerald-400"/>Settings saved</div>}
  </div>;
};

function Toggle({label,detail,checked,onChange,icon}:{label:string;detail:string;checked:boolean;onChange:(value:boolean)=>void;icon?:React.ReactNode}){
  return <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4"><div className="flex gap-2.5">{icon&&<span className="mt-0.5 text-slate-500">{icon}</span>}<div><p className="text-sm font-semibold text-slate-900">{label}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p></div></div><button type="button" aria-pressed={checked} onClick={()=>onChange(!checked)} className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked?'bg-blue-600':'bg-slate-200'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked?'left-6':'left-1'}`}/></button></div>;
}
