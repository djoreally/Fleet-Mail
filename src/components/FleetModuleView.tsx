import React from 'react';
import { Sparkles } from 'lucide-react';
import { WorkOrdersWorkspace, MaintenanceWorkspace } from './operations/OperationsWorkspace';
import { PartsWorkspace, CustomersWorkspace } from './operations';
import { ProspectCommandCenter } from './operations/ProspectCommandCenter';
import { ProspectInboxSyncButton } from './operations/ProspectInboxSyncButton';
import { ScheduleDispatchView } from './ScheduleDispatchView';
import { FinancialsLiveView, DocumentsLiveView } from './FinancialDocumentsViews';
import { VehicleWorkspace } from './vehicles/VehicleWorkspace';
import { VehicleSpecificationsManager } from './vehicles/VehicleSpecificationsManager';

export type FleetModuleId = 'vehicles'|'work-orders'|'maintenance'|'schedule'|'dispatch'|'parts'|'prospects'|'customers'|'financials'|'documents';
interface FleetModuleViewProps { module:FleetModuleId; onOpenInbox:()=>void; }
const VehiclesLive=()=> <div className="flex min-h-0 flex-1 flex-col"><VehicleWorkspace/><VehicleSpecificationsManager/></div>;
const ProspectingLive=()=> <div className="flex min-h-0 flex-1 flex-col"><ProspectInboxSyncButton/><ProspectCommandCenter/></div>;

/** Routes Fleet OS only to live API-backed workspaces; no sample operational records. */
export const FleetModuleView:React.FC<FleetModuleViewProps>=({module})=>{const screens:Record<FleetModuleId,React.ReactNode>={vehicles:<VehiclesLive/>,'work-orders':<WorkOrdersWorkspace/>,maintenance:<MaintenanceWorkspace/>,schedule:<ScheduleDispatchView mode="schedule"/>,dispatch:<ScheduleDispatchView mode="dispatch"/>,parts:<PartsWorkspace/>,prospects:<ProspectingLive/>,customers:<CustomersWorkspace/>,financials:<FinancialsLiveView/>,documents:<DocumentsLiveView/>};return <div className="flex min-h-0 flex-1 flex-col">{screens[module]}<div className="mx-5 mb-5 mt-1 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm lg:mx-8 lg:mb-8"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Fleet lifecycle</p><p className="mt-1 text-xs font-semibold text-slate-700">Prospect → Win → Fleet Account → Vehicle → Work Order → Service → Invoice → Retain</p></div><Sparkles className="h-5 w-5 text-blue-500"/></div></div>};
