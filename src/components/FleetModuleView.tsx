import React from'react';
import{MaintenanceWorkspace}from'./operations/OperationsWorkspace';
import{WorkOrderOperationsHub}from'./operations/TechnicianWorkspace';
import{FleetAccountsCertifiedWorkspace}from'./operations/FleetAccountsCertifiedWorkspace';
import{PartsWorkspace}from'./operations/PartsWorkspace';
import{ProspectCommandCenter}from'./operations/ProspectCommandCenter';
import{ProspectInboxSyncButton}from'./operations/ProspectInboxSyncButton';
import{FinancialsLiveView,DocumentsLiveView}from'./FinancialDocumentsViews';
import{ScheduleDispatchView}from'./ScheduleDispatchView';
import{VehicleWorkspace}from'./vehicles/VehicleWorkspace';

export type FleetModuleId='vehicles'|'work-orders'|'maintenance'|'schedule'|'dispatch'|'parts'|'prospects'|'customers'|'financials'|'documents';
interface FleetModuleViewProps{module:FleetModuleId;onOpenInbox:()=>void}
const ProspectingLive=()=> <div className="flex min-h-0 flex-1 flex-col"><ProspectInboxSyncButton/><ProspectCommandCenter/></div>;
/** Fleet Accounts owns customer onboarding and recovery before child operational records are opened. */
export const FleetModuleView:React.FC<FleetModuleViewProps>=({module})=>{const screens:Record<FleetModuleId,React.ReactNode>={vehicles:<VehicleWorkspace/>,'work-orders':<WorkOrderOperationsHub/>,maintenance:<MaintenanceWorkspace/>,schedule:<ScheduleDispatchView mode="schedule"/>,dispatch:<ScheduleDispatchView mode="dispatch"/>,parts:<PartsWorkspace/>,prospects:<ProspectingLive/>,customers:<FleetAccountsCertifiedWorkspace/>,financials:<FinancialsLiveView/>,documents:<DocumentsLiveView/>};return <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#f7f8fa]">{screens[module]}</div>};
