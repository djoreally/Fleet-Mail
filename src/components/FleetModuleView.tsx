import React,{useEffect,useState}from'react';
import{MaintenanceWorkspace}from'./operations/OperationsWorkspace';
import{WorkOrderOperationsHub}from'./operations/TechnicianWorkspace';
import{FleetServiceWorkspace}from'./operations/FleetServiceWorkspace';
import{FleetAccountsWorkspace}from'./operations/FleetAccountsWorkspace';
import{ProspectCommandCenter}from'./operations/ProspectCommandCenter';
import{ProspectInboxSyncButton}from'./operations/ProspectInboxSyncButton';
import{FinancialsLiveView,DocumentsLiveView}from'./FinancialDocumentsViews';
import{fleetFetch}from'../lib/fleetApi';

export type FleetModuleId='vehicles'|'work-orders'|'maintenance'|'schedule'|'dispatch'|'parts'|'prospects'|'customers'|'financials'|'documents';
interface FleetModuleViewProps{module:FleetModuleId;onOpenInbox:()=>void}
const ProspectingLive=()=> <div className="flex min-h-0 flex-1 flex-col"><ProspectInboxSyncButton/><ProspectCommandCenter/></div>;
const RoleAwareWorkOrders=()=>{const[role,setRole]=useState<string|null>(null);useEffect(()=>{let live=true;void fleetFetch('/api/access').then(r=>r.json()).then(v=>{if(live)setRole(String(v.role||''))}).catch(()=>{if(live)setRole('')});return()=>{live=false}},[]);if(role===null)return <div className="grid flex-1 place-items-center bg-[#f7f8fa] text-sm text-slate-500">Loading work orders…</div>;return role==='technician'?<WorkOrderOperationsHub/>:<FleetServiceWorkspace initialTab="work-orders"/>};
/** Fleet Accounts is the parent entry point. Agreement/SLA, vehicles and future work belong to that account. */
export const FleetModuleView:React.FC<FleetModuleViewProps>=({module})=>{const screens:Record<FleetModuleId,React.ReactNode>={vehicles:<FleetServiceWorkspace initialTab="vehicles"/>,'work-orders':<RoleAwareWorkOrders/>,maintenance:<MaintenanceWorkspace/>,schedule:<FleetServiceWorkspace initialTab="schedule"/>,dispatch:<FleetServiceWorkspace initialTab="dispatch"/>,parts:<FleetServiceWorkspace initialTab="parts"/>,prospects:<ProspectingLive/>,customers:<FleetAccountsWorkspace/>,financials:<FinancialsLiveView/>,documents:<DocumentsLiveView/>};return <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#f7f8fa]">{screens[module]}</div>};
