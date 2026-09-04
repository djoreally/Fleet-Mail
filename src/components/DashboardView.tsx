import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowRight, BadgeDollarSign, Bot, Building2, CalendarClock,
  Car, CheckCircle2, ClipboardList, Clock3, FileText, RefreshCw, Target, Wrench
} from 'lucide-react';
import { fleetFetch } from '../lib/fleetApi';
import type { AppTab } from './Sidebar';

type AttentionItem = { kind:string; title:string; subtitle:string; severity:'critical'|'warning'|'info'; target:AppTab };
type OperationItem = { id:string; startsAt:string; status:string; customerName:string|null; unitNumber:string|null; workOrderNumber:string|null };
type ActivityItem = { id:string; number:string; status:string; customerName:string|null; unitNumber:string|null; updatedAt:string };
type DashboardData = {
  generatedAt:string;
  summary:{ fleetAccounts:number; vehicles:number; openWorkOrders:number; activeProspects:number };
  attention:AttentionItem[];
  upcomingOperations:OperationItem[];
  financials:{ outstanding:string; overdue:string; collected:string };
  pipeline:{ total:number; followUpDue:number; stages:Record<string,number> };
  recentActivity:ActivityItem[];
};

interface DashboardViewProps { onNavigate:(tab:AppTab)=>void; onAskAgent:(prompt:string)=>void; }
const money=(value:string)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value||0));
const when=(value:string)=>new Intl.DateTimeFormat(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}).format(new Date(value));
const statusLabel=(value:string)=>String(value||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

export const DashboardView:React.FC<DashboardViewProps>=({onNavigate,onAskAgent})=>{
  const [data,setData]=useState<DashboardData|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{const res=await fleetFetch('/api/dashboard');const body=await res.json();if(!res.ok)throw new Error(body.error||'Dashboard unavailable');setData(body);}
    catch(e){setError(e instanceof Error?e.message:'Dashboard unavailable');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);

  if(loading&&!data)return <div className="flex flex-1 items-center justify-center bg-slate-50"><RefreshCw className="h-5 w-5 animate-spin text-blue-600"/></div>;
  if(error&&!data)return <div className="flex flex-1 items-center justify-center bg-slate-50 p-6"><div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm"><AlertTriangle className="mx-auto h-6 w-6 text-red-500"/><p className="mt-3 font-semibold text-slate-900">Dashboard could not load</p><p className="mt-1 text-sm text-slate-500">{error}</p><button onClick={()=>void load()} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Retry</button></div></div>;
  if(!data)return null;

  const kpis=[
    {label:'Fleet Accounts',value:data.summary.fleetAccounts,icon:Building2,tab:'customers' as AppTab},
    {label:'Active Vehicles',value:data.summary.vehicles,icon:Car,tab:'vehicles' as AppTab},
    {label:'Open Work Orders',value:data.summary.openWorkOrders,icon:ClipboardList,tab:'work-orders' as AppTab},
    {label:'Active Prospects',value:data.summary.activeProspects,icon:Target,tab:'prospects' as AppTab},
  ];
  const quick=[
    ['Fleet Accounts','customers',Building2],['Vehicles','vehicles',Car],['Work Orders','work-orders',ClipboardList],
    ['Maintenance','maintenance',Wrench],['Schedule','schedule',CalendarClock],['Dispatch','dispatch',CalendarClock],
    ['Prospects','prospects',Target],['Financials','financials',BadgeDollarSign],['Documents','documents',FileText]
  ] as const;
  const prompts=['What needs attention?','Show open work orders','Which fleet accounts need follow-up?','Find a new fleet prospect'];

  return <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50">
    <div className="mx-auto max-w-[1500px] space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-600">Operations command center</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Fleet OS Dashboard</h2><p className="mt-1 text-sm text-slate-500">Live organization data only. No mileage telemetry is assumed.</p></div><button onClick={()=>void load()} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>Refresh</button></div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{kpis.map(({label,value,icon:Icon,tab})=><button key={label} onClick={()=>onNavigate(tab)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md sm:p-5"><div className="flex items-center justify-between"><span className="rounded-xl bg-blue-50 p-2 text-blue-600"><Icon className="h-4 w-4"/></span><ArrowRight className="h-4 w-4 text-slate-300"/></div><p className="mt-4 text-2xl font-bold text-slate-950">{value}</p><p className="text-xs font-semibold text-slate-500 sm:text-sm">{label}</p></button>)}</section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold text-slate-900">Attention Required</h3><p className="text-xs text-slate-500">Review, authorization, collections and follow-up signals</p></div><AlertTriangle className="h-5 w-5 text-amber-500"/></div><div className="divide-y divide-slate-100">{data.attention.length?data.attention.map((item,index)=><button key={`${item.kind}-${index}`} onClick={()=>onNavigate(item.target)} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-slate-50"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.severity==='critical'?'bg-red-500':item.severity==='warning'?'bg-amber-500':'bg-blue-500'}`}/><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{item.title}</span><span className="mt-0.5 block text-xs text-slate-500">{item.subtitle}</span></span><ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300"/></button>):<div className="px-5 py-8 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500"/><p className="mt-2 text-sm font-semibold text-slate-700">No current attention items</p></div>}</div></div>

        <div className="rounded-2xl border border-blue-200 bg-slate-950 p-5 text-white shadow-sm"><div className="flex items-center gap-3"><span className="rounded-xl bg-blue-500/20 p-2 text-blue-300"><Bot className="h-5 w-5"/></span><div><h3 className="font-bold">Fleet Agent</h3><p className="text-xs text-slate-400">Ask across Fleet OS records</p></div></div><div className="mt-5 grid gap-2">{prompts.map(prompt=><button key={prompt} onClick={()=>onAskAgent(prompt)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm font-medium text-slate-200 hover:bg-white/10">{prompt}</button>)}</div></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold text-slate-900">Next 24 Hours</h3><p className="text-xs text-slate-500">Scheduled appointments from canonical Fleet OS records</p></div><Clock3 className="h-5 w-5 text-blue-500"/></div><div className="divide-y divide-slate-100">{data.upcomingOperations.length?data.upcomingOperations.map(item=><button key={item.id} onClick={()=>onNavigate('schedule')} className="grid w-full grid-cols-[90px_1fr_auto] items-center gap-3 px-5 py-3 text-left hover:bg-slate-50"><span className="text-xs font-semibold text-blue-700">{when(item.startsAt)}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{item.customerName||'Fleet account'}{item.unitNumber?` · Unit ${item.unitNumber}`:''}</span><span className="block text-xs text-slate-500">{item.workOrderNumber||'Appointment'}</span></span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{statusLabel(item.status)}</span></button>):<div className="px-5 py-8 text-center text-sm text-slate-500">No appointments in the next 24 hours.</div>}</div></div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-bold text-slate-900">Financial Position</h3><p className="text-xs text-slate-500">Canonical invoices and posted paid payments</p></div><BadgeDollarSign className="h-5 w-5 text-emerald-600"/></div><div className="mt-5 grid grid-cols-3 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">Outstanding</p><p className="mt-1 text-lg font-bold text-slate-950">{money(data.financials.outstanding)}</p></div><div className="rounded-xl bg-red-50 p-3"><p className="text-xs font-semibold text-red-600">Overdue</p><p className="mt-1 text-lg font-bold text-red-700">{money(data.financials.overdue)}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-600">Collected</p><p className="mt-1 text-lg font-bold text-emerald-700">{money(data.financials.collected)}</p></div></div><button onClick={()=>onNavigate('financials')} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">Open financials <ArrowRight className="h-4 w-4"/></button></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-bold text-slate-900">Revenue Pipeline</h3><p className="text-xs text-slate-500">{data.pipeline.followUpDue} follow-ups due now</p></div><Target className="h-5 w-5 text-violet-600"/></div><div className="mt-4 flex flex-wrap gap-2">{Object.entries(data.pipeline.stages).length?Object.entries(data.pipeline.stages).map(([stage,count])=><span key={stage} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">{statusLabel(stage)} · {count}</span>):<span className="text-sm text-slate-500">No active prospects.</span>}</div><button onClick={()=>onNavigate('prospects')} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">Open prospects <ArrowRight className="h-4 w-4"/></button></div><div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h3 className="font-bold text-slate-900">Recent Work</h3><p className="text-xs text-slate-500">Latest work-order activity</p></div><div className="divide-y divide-slate-100">{data.recentActivity.map(item=><button key={item.id} onClick={()=>onNavigate('work-orders')} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50"><ClipboardList className="h-4 w-4 text-slate-400"/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{item.number} · {item.customerName||'Fleet account'}</span><span className="block text-xs text-slate-500">{item.unitNumber?`Unit ${item.unitNumber} · `:''}{statusLabel(item.status)}</span></span></button>)}</div></div></section>

      <section><div className="mb-3"><h3 className="font-bold text-slate-900">Fleet OS</h3><p className="text-xs text-slate-500">Jump directly into every operational workspace</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{quick.map(([label,tab,Icon])=><button key={tab} onClick={()=>onNavigate(tab)} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-blue-200 hover:bg-blue-50/40"><span className="rounded-lg bg-slate-100 p-2 text-slate-600"><Icon className="h-4 w-4"/></span><span className="text-sm font-semibold text-slate-800">{label}</span></button>)}</div></section>
    </div>
  </main>;
};
