import React, { useEffect, useMemo, useState } from 'react';
import { Inbox, Send, FileText, Bot, Users, Settings, PenSquare, Car, ClipboardList, Wrench, CalendarClock, PackageSearch, Building2, BadgeDollarSign, Files, Target, LogOut, LayoutDashboard } from 'lucide-react';
import { clearPendingFleetInvitation, fleetFetch } from '../lib/fleetApi';
import { defaultWorkspaceTab, workspaceAllowsTab, type WorkspaceTab } from '../lib/workspacePolicy';

export type AppTab = WorkspaceTab;

type Access = { role: string; permissions: string[] };
type NavItem = { id: AppTab; label: string; icon: React.ReactNode; count?: number; permission?: string };

interface SidebarProps {
  currentTab: AppTab; onSelectTab: (tab: AppTab) => void; inboxCount: number; sentCount: number; draftsCount: number;
  contactsCount?: number; onOpenCompose: () => void; userEmail?: string; userName?: string; userAvatar?: string;
  onSignOut?: () => void; mobileOpen?: boolean; onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab,onSelectTab,inboxCount,sentCount,draftsCount,contactsCount=0,onOpenCompose,userEmail='operator@fleetos.app',userName='Fleet User',userAvatar,onSignOut,mobileOpen=false,onMobileClose }) => {
  const [access,setAccess]=useState<Access|null>(null);
  useEffect(()=>{let live=true;(async()=>{try{const r=await fleetFetch('/api/access');if(!r.ok)return;const data=await r.json();if(live){setAccess(data);clearPendingFleetInvitation();}}catch{}})();return()=>{live=false};},[]);
  useEffect(()=>{if(access&&!workspaceAllowsTab(access.role,currentTab))onSelectTab(defaultWorkspaceTab(access.role));},[access,currentTab,onSelectTab]);
  const allowed=(permission?:string)=>!permission||Boolean(access?.permissions?.includes(permission));
  const tabAllowed=(tab:AppTab)=>!access||workspaceAllowsTab(access.role,tab);

  const mailItems: NavItem[] = [
    { id:'inbox',label:'Fleet Inbox',icon:<Inbox className="w-4 h-4"/>,count:inboxCount,permission:'inbox.view' },
    { id:'sent',label:'Sent',icon:<Send className="w-4 h-4"/>,count:sentCount||undefined,permission:'inbox.view' },
    { id:'drafts',label:'Drafts',icon:<FileText className="w-4 h-4"/>,count:draftsCount||undefined,permission:'inbox.view' },
    { id:'contacts',label:'Contacts',icon:<Users className="w-4 h-4"/>,count:contactsCount||undefined,permission:'inbox.view' },
    { id:'chat',label:'Fleet Agent',icon:<Bot className="w-4 h-4"/>,permission:'agent.use' },
  ];
  const fleetItems: NavItem[] = [
    { id:'prospects',label:'Prospects',icon:<Target className="w-4 h-4"/>,permission:'prospects.view' },
    { id:'customers',label:'Fleet Accounts',icon:<Building2 className="w-4 h-4"/>,permission:'fleet_accounts.view' },
    { id:'vehicles',label:'Vehicles',icon:<Car className="w-4 h-4"/>,permission:'vehicles.view' },
    { id:'work-orders',label:'Work Orders',icon:<ClipboardList className="w-4 h-4"/>,permission:'work_orders.view' },
    { id:'maintenance',label:'Maintenance',icon:<Wrench className="w-4 h-4"/>,permission:'work_orders.view' },
    { id:'schedule',label:'Schedule',icon:<CalendarClock className="w-4 h-4"/>,permission:'schedule.view' },
    { id:'dispatch',label:'Dispatch',icon:<CalendarClock className="w-4 h-4"/>,permission:'dispatch.view' },
    { id:'parts',label:'Parts',icon:<PackageSearch className="w-4 h-4"/>,permission:'work_orders.view' },
    { id:'financials',label:'Invoices & Financials',icon:<BadgeDollarSign className="w-4 h-4"/>,permission:'financials.view' },
    { id:'documents',label:'Documents',icon:<Files className="w-4 h-4"/>,permission:'documents.view' },
  ];
  const visibleMail=useMemo(()=>mailItems.filter(i=>tabAllowed(i.id)&&allowed(i.permission)),[access,inboxCount,sentCount,draftsCount,contactsCount]);
  const visibleFleet=useMemo(()=>fleetItems.filter(i=>tabAllowed(i.id)&&allowed(i.permission)),[access]);
  const nav=(item:NavItem)=>{const active=currentTab===item.id;return <button key={item.id} id={`nav-${item.id}`} onClick={()=>{onSelectTab(item.id);onMobileClose?.()}} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${active?'bg-[#e8f0fe] text-[#0b57d0] font-semibold':'text-slate-700 hover:bg-slate-100/80'}`}><div className="flex items-center gap-3"><span className={active?'text-[#0b57d0]':'text-slate-600'}>{item.icon}</span><span>{item.label}</span></div>{typeof item.count==='number'&&item.count>0&&<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{item.count}</span>}</button>};

  return <aside id="app-sidebar" className={`${mobileOpen?'flex':'hidden'} fixed inset-y-0 left-0 z-50 w-[min(86vw,20rem)] bg-white border-r border-slate-200 flex-col justify-between shrink-0 h-[100dvh] overflow-hidden shadow-2xl lg:static lg:z-auto lg:flex lg:w-64 lg:shadow-none`}>
    <div className="p-4 space-y-5 overflow-y-auto">
      <div className="flex items-center gap-3 px-1"><div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600"><Wrench className="w-5 h-5"/></div><div><h1 className="text-base font-bold tracking-tight text-slate-900 leading-none">Fleet OS</h1><p className="text-xs text-slate-500 font-medium mt-0.5">AI Revenue + Operations</p></div></div>
      {tabAllowed('dashboard')&&<button id="nav-dashboard" onClick={()=>{onSelectTab('dashboard');onMobileClose?.()}} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold ${currentTab==='dashboard'?'bg-[#e8f0fe] text-[#0b57d0]':'text-slate-700 hover:bg-slate-100/80'}`}><LayoutDashboard className="w-4 h-4"/><span>Dashboard</span></button>}
      {tabAllowed('inbox')&&allowed('inbox.send')&&<button id="sidebar-compose-btn" onClick={onOpenCompose} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#0b57d0] hover:bg-[#0848b0] text-white font-medium text-sm"><PenSquare className="w-4 h-4"/><span>Compose</span></button>}
      {visibleMail.length>0&&<nav className="space-y-1">{visibleMail.map(nav)}</nav>}
      {visibleFleet.length>0&&<nav className="space-y-1" aria-label="Fleet revenue and operations"><p className="px-3.5 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Revenue + Operations</p>{visibleFleet.map(nav)}</nav>}
    </div>
    <div className="p-3 border-t border-slate-100 space-y-2">
      {tabAllowed('settings')&&allowed('settings.view')&&<button id="nav-settings-btn" onClick={()=>{onSelectTab('settings');onMobileClose?.()}} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium ${currentTab==='settings'?'bg-[#e8f0fe] text-[#0b57d0] font-semibold':'text-slate-700 hover:bg-slate-100/80'}`}><Settings className="w-4 h-4"/><span>Settings</span></button>}
      <div className="flex items-center gap-3 px-2 py-2 rounded-xl">{userAvatar?<img src={userAvatar} alt={userName} className="w-8 h-8 rounded-full object-cover border border-slate-200"/>:<div className="w-8 h-8 rounded-full bg-blue-100 text-[#0b57d0] flex items-center justify-center text-xs font-bold">{userName.slice(0,1).toUpperCase()}</div>}<div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-900 truncate">{userName}</p><p className="text-[11px] text-slate-500 truncate">{access?.role?`${access.role} · `:''}{userEmail}</p></div>{onSignOut&&<button type="button" onClick={onSignOut} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Sign out"><LogOut className="h-4 w-4"/></button>}</div>
    </div>
  </aside>;
};
