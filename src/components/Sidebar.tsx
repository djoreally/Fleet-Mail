import React from 'react';
import {
  Inbox,
  Send,
  FileText,
  Bot,
  Users,
  Settings,
  PenSquare,
  Car,
  ClipboardList,
  Wrench,
  CalendarClock,
  PackageSearch,
  Building2,
  BadgeDollarSign,
  Files
  ,LogOut
} from 'lucide-react';

export type AppTab = 'inbox' | 'sent' | 'drafts' | 'contacts' | 'chat' | 'settings'
  | 'vehicles' | 'work-orders' | 'maintenance' | 'dispatch' | 'parts' | 'customers'
  | 'schedule' | 'financials' | 'documents';

interface SidebarProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  inboxCount: number;
  sentCount: number;
  draftsCount: number;
  contactsCount?: number;
  onOpenCompose: () => void;
  userEmail?: string;
  userName?: string;
  userAvatar?: string;
  onSignOut?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  inboxCount,
  sentCount,
  draftsCount,
  contactsCount = 0,
  onOpenCompose,
  userEmail = 'operator@fleetos.app',
  userName = 'Alex Carter',
  userAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  onSignOut
}) => {
  const mailItems: Array<{
    id: AppTab;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }> = [
    {
      id: 'inbox',
      label: 'Fleet Inbox',
      icon: <Inbox className="w-4 h-4" />,
      count: inboxCount
    },
    {
      id: 'sent',
      label: 'Sent',
      icon: <Send className="w-4 h-4" />,
      count: sentCount > 0 ? sentCount : undefined
    },
    {
      id: 'drafts',
      label: 'Drafts',
      icon: <FileText className="w-4 h-4" />,
      count: draftsCount > 0 ? draftsCount : undefined
    },
    {
      id: 'contacts',
      label: 'Contacts',
      icon: <Users className="w-4 h-4" />,
      count: contactsCount > 0 ? contactsCount : undefined
    },
    {
      id: 'chat',
      label: 'AtlasCloud Agent',
      icon: <Bot className="w-4 h-4" />
    }
  ];

  const fleetItems: Array<{ id: AppTab; label: string; icon: React.ReactNode }> = [
    { id: 'vehicles', label: 'Vehicles', icon: <Car className="w-4 h-4" /> },
    { id: 'work-orders', label: 'Work Orders', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'maintenance', label: 'Maintenance', icon: <Wrench className="w-4 h-4" /> },
    { id: 'schedule', label: 'Schedule', icon: <CalendarClock className="w-4 h-4" /> },
    { id: 'dispatch', label: 'Dispatch', icon: <CalendarClock className="w-4 h-4" /> },
    { id: 'parts', label: 'Parts', icon: <PackageSearch className="w-4 h-4" /> },
    { id: 'customers', label: 'Customers', icon: <Building2 className="w-4 h-4" /> },
    { id: 'financials', label: 'Invoices & Financials', icon: <BadgeDollarSign className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <Files className="w-4 h-4" /> }
  ];

  return (
    <aside id="app-sidebar" className="w-60 md:w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 h-full select-none overflow-hidden">
      {/* Top Section */}
      <div className="p-4 space-y-5 overflow-y-auto">
        {/* Brand */}
        <div className="flex items-center gap-3 px-1">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm text-blue-600">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 leading-none">
              Fleet OS
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Operations Command Center
            </p>
          </div>
        </div>

        {/* Compose Button */}
        <button
          id="sidebar-compose-btn"
          onClick={onOpenCompose}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#0b57d0] hover:bg-[#0848b0] active:scale-[0.98] text-white font-medium text-sm shadow-sm transition-all duration-150"
        >
          <PenSquare className="w-4 h-4" />
          <span>Compose</span>
        </button>

        {/* Main Navigation */}
        <nav className="space-y-1">
          {mailItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#e8f0fe] text-[#0b57d0] font-semibold'
                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-[#0b57d0]' : 'text-slate-600'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                      isActive
                        ? 'bg-blue-200/70 text-blue-900'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <nav className="space-y-1" aria-label="Fleet operations">
          <p className="px-3.5 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Operations</p>
          {fleetItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button key={item.id} id={`nav-${item.id}`} onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${isActive ? 'bg-[#e8f0fe] text-[#0b57d0] font-semibold' : 'text-slate-700 hover:bg-slate-100/80'}`}>
                <span className={isActive ? 'text-[#0b57d0]' : 'text-slate-600'}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Settings & User Profile */}
      <div className="p-3 border-t border-slate-100 space-y-2">
        {/* Settings button */}
        <button
          id="nav-settings-btn"
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
            currentTab === 'settings'
              ? 'bg-[#e8f0fe] text-[#0b57d0] font-semibold'
              : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
          }`}
        >
          <Settings className={`w-4 h-4 ${currentTab === 'settings' ? 'text-[#0b57d0]' : 'text-slate-600'}`} />
          <span>Settings</span>
        </button>

        {/* User Card */}
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors">
          <img
            src={userAvatar}
            alt={userName}
            className="w-8 h-8 rounded-full object-cover border border-slate-200"
          />
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-slate-900 truncate">
              {userName}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {userEmail}
            </p>
          </div>
          {onSignOut && <button type="button" onClick={onSignOut} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>}
        </div>
      </div>
    </aside>
  );
};
