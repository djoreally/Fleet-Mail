import React,{useEffect,useState}from'react';
import{Sparkles}from'lucide-react';
import{MaintenanceWorkspace}from'./operations/OperationsWorkspace';
import{WorkOrderOperationsHub}from'./operations/TechnicianWorkspace';
import{FleetServiceWorkspace}from'./operations/FleetServiceWorkspace';
import{ProspectCommandCenter}from'./operations/ProspectCommandCenter';
import{ProspectInboxSyncButton}from'./operations/ProspectInboxSyncButton';
import{FinancialsLiveView,DocumentsLiveView}from'./FinancialDocumentsViews';
import{fleetFetch}from'../lib/fleetApi';

export type FleetModuleId='vehicles'|'work-orders'|'maintenance'|'schedule'|'dispatch'|'parts'|'prospects'|'customers'|'financials'|'documents';
interface FleetModuleViewProps{module:FleetModuleId;onOpenInbox:()=>void}
const ProspectingLive=()=> <div className="flex min-h-0 flex-1 flex-col"><ProspectInboxSyncButton/><ProspectCommandCenter/></div>;
const RoleAwareWorkOrders=()=>{const[role,setRole]=useState<string|null>(null);useEffect(()=>{let live=true;void fleetFetch('/api/access').then(r=>r.json()).then(v=>{if(live)setRole(String(v.role||''))}).catch(()=>{if(live)setRole('')});return()=>{live=false}},[]);if(role===null)return <div className="grid flex-1 place-items-center bg-slate-50 text-sm text-slate-500">Loading work orders…</div>;return role==='technician'?<WorkOrderOperationsHub/>:<FleetServiceWorkspace initialTab="work-orders"/>};
/** Live Fleet modules share one canonical Client → Vehicle → Work Order chain. */
export const FleetModuleView:React.FC<FleetModuleViewProps>=({module})=>{const screens:Record<FleetModuleId,React.ReactNode>={vehicles:<FleetServiceWorkspace initialTab="vehicles"/>,'work-orders':<RoleAwareWorkOrders/>,maintenance:<MaintenanceWorkspace/>,schedule:<FleetServiceWorkspace initialTab="schedule"/>,dispatch:<FleetServiceWorkspace initialTab="dispatch"/>,parts:<FleetServiceWorkspace initialTab="parts"/>,prospects:<ProspectingLive/>,customers:<FleetServiceWorkspace initialTab="accounts"/>,financials:<FinancialsLiveView/>,documents:<DocumentsLiveView/>};return <div className="flex min-h-0 flex-1 flex-col">{screens[module]}<div className="mx-5 mb-5 mt-1 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm lg:mx-8 lg:mb-8"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Fleet lifecycle</p><p className="mt-1 text-xs font-semibold text-slate-700">Prospect → Win → Fleet Account → SLA & Pricing → Vehicle → Work Order → Schedule → Dispatch → Service → Invoice → Retain</p></div><Sparkles className="h-5 w-5 text-blue-500"/></div></div>};
