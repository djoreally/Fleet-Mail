import React from 'react';
import { Search, HelpCircle, Bell, User } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  unreadNotificationsCount?: number;
  onOpenHelp?: () => void;
  onOpenSettings?: () => void;
  pageTitle?: string;
  userAvatar?: string;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  unreadNotificationsCount = 1,
  onOpenHelp,
  onOpenSettings,
  pageTitle,
  userAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
}) => {
  return (
    <header id="main-header" className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-20 shrink-0">
      {/* Left / Page Title or Search Bar */}
      {pageTitle ? (
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-[#0b57d0] tracking-tight">
            {pageTitle}
          </h2>
        </div>
      ) : (
        <div className="w-full max-w-xl">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              id="global-search-input"
              type="text"
              placeholder="Search Mail & Chat..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0b57d0] focus:ring-2 focus:ring-blue-100 transition-all shadow-xs"
            />
          </div>
        </div>
      )}

      {/* Right Utilities */}
      <div className="flex items-center gap-2">
        {/* Help Icon */}
        <button
          id="header-help-btn"
          onClick={onOpenHelp}
          title="Help & System Info"
          className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* Notifications Icon with Red Dot */}
        <button
          id="header-notifications-btn"
          title="Notifications"
          className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative"
        >
          <Bell className="w-5 h-5" />
          {unreadNotificationsCount > 0 && (
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full absolute top-1.5 right-1.5 border-2 border-white ring-1 ring-red-400 animate-pulse"></span>
          )}
        </button>

        {/* User Avatar Circle */}
        <button
          id="header-profile-btn"
          onClick={onOpenSettings}
          title="Profile & Settings"
          className="p-1 rounded-full text-slate-600 hover:bg-slate-100 transition-colors ml-1"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 shadow-xs">
            <img
              src={userAvatar}
              alt="User profile"
              className="w-full h-full object-cover"
            />
          </div>
        </button>
      </div>
    </header>
  );
};
