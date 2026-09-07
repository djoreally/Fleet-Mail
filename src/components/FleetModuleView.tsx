import React,{useEffect,useState}from'react';
import{ChevronRight}from'lucide-react';
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
const RoleAwareWorkOrders=()=>{const[role,setRole]=useState<string|null>(null);useEffect(()=>{let live=true;void fleetFetch('/api/access').then(r=>r.json()).then(v=>{if(live)setRole(String(v.role||''))}).catch(()=>{if(live)setRole('')});return()=>{live=false}},[]);if(role===null)return <div className="grid flex-1 place-items-center bg-[#f7f8fa] text-sm text-slate-500">Loading work orders…</div>;return role==='technician'?<WorkOrderOperationsHub/>:<FleetServiceWorkspace initialTab="work-orders"/>};
const lifecycle=['Prospect','Win','Fleet account','SLA + pricing','Vehicle','Work order','Schedule','Dispatch','Service','Invoice','Retain'];
/** Live Fleet modules share one canonical Client → Vehicle → Work Order chain. */
export const FleetModuleView:React.FC<FleetModuleViewProps>=({module})=>{const screens:Record<FleetModuleId,React.ReactNode>={vehicles:<FleetServiceWorkspace initialTab="vehicles"/>,'work-orders':<RoleAwareWorkOrders/>,maintenance:<MaintenanceWorkspace/>,schedule:<FleetServiceWorkspace initialTab="schedule"/>,dispatch:<FleetServiceWorkspace initialTab="dispatch"/>,parts:<FleetServiceWorkspace initialTab="parts"/>,prospects:<ProspectingLive/>,customers:<FleetServiceWorkspace initialTab="accounts"/>,financials:<FinancialsLiveView/>,documents:<DocumentsLiveView/>};return <div className="flex min-h-0 flex-1 flex-col bg-[#f7f8fa]">{screens[module]}<div className="mx-3 mb-4 overflow-x-auto border-y border-slate-200 bg-white px-4 py-2.5 sm:mx-5 lg:mx-7"><div className="flex min-w-max items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.07em] text-slate-400"><span className="mr-2 text-slate-600">Fleet lifecycle</span>{lifecycle.map((item,index)=><React.Fragment key={item}><span>{item}</span>{index<lifecycle.length-1&&<ChevronRight className="h-3 w-3 text-slate-300"/>}</React.Fragment>)}</div></div></div>};
