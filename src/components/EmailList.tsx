import React from 'react';
import { SlidersHorizontal, Sparkles, Inbox as InboxIcon, RefreshCw, Radio } from 'lucide-react';
import { EmailMessage } from '../types';

interface EmailListProps {
  emails: EmailMessage[];
  selectedEmailId: string | null;
  onSelectEmail: (email: EmailMessage) => void;
  folderTitle?: string;
  onOpenFilter?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  activeInbox?: string;
}

export const EmailList: React.FC<EmailListProps> = ({
  emails,
  selectedEmailId,
  onSelectEmail,
  folderTitle = 'Inbox',
  onOpenFilter,
  onRefresh,
  isRefreshing = false,
  activeInbox
}) => {
  return (
    <div id="email-list-pane" className="w-full md:w-80 lg:w-[360px] bg-white border-r border-slate-200 flex flex-col h-full shrink-0 select-none">
      {/* Inbox Header with Filter & Live Refresh */}
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {folderTitle}
            </h2>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {emails.length}
            </span>
          </div>
          {activeInbox && (
            <p className="text-[11px] text-slate-500 font-mono truncate max-w-[180px]">
              {activeInbox}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onRefresh && (
            <button
              id="email-refresh-btn"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh messages from AgentMail"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#0b57d0]' : ''}`} />
            </button>
          )}
          <button
            id="email-filter-btn"
            onClick={onOpenFilter}
            title="Filter emails"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List of Emails */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {emails.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
              <InboxIcon className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-600">No emails in {folderTitle}</p>
          </div>
        ) : (
          emails.map((email) => {
            const isSelected = email.id === selectedEmailId;
            const isUnread = !email.read;

            return (
              <div
                key={email.id}
                id={`email-item-${email.id}`}
                onClick={() => onSelectEmail(email)}
                className={`p-4 cursor-pointer transition-all duration-150 relative ${
                  isSelected
                    ? 'bg-slate-50/90 border-l-4 border-l-[#0b57d0]'
                    : 'hover:bg-slate-50/60'
                }`}
              >
                {/* Unread indicator dot */}
                {isUnread && (
                  <span className="w-2 h-2 rounded-full bg-[#0b57d0] absolute left-2 top-5"></span>
                )}

                {/* Top Row: Sender & Timestamp */}
                <div className="flex items-center justify-between pl-2">
                  <span className={`text-sm tracking-tight truncate max-w-[190px] ${
                    isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                  }`}>
                    {email.fromName || email.from.split('<')[0].replace(/"/g, '').trim()}
                  </span>
                  <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                    {email.formattedTime || (email.created_at ? new Date(email.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}
                  </span>
                </div>

                {/* Middle: Subject */}
                <div className="pl-2 mt-0.5">
                  <p className={`text-sm truncate ${
                    isUnread ? 'font-semibold text-slate-900' : 'text-slate-800'
                  }`}>
                    {email.subject || '(No Subject)'}
                  </p>
                </div>

                {/* Bottom: Snippet */}
                <div className="pl-2 mt-1">
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {email.text ? email.text.replace(/\n/g, ' ') : '(Empty message body)'}
                  </p>
                </div>

                {/* Action Required Pill Badge (if extracted by AI) */}
                {(email.actionRequired || email.summary?.actionItems?.[0]) && (
                  <div className="pl-2 mt-2.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
                      <Sparkles className="w-3 h-3 text-[#0b57d0]" />
                      <span>
                        {email.actionRequired || `Action required: ${email.summary?.actionItems[0]}`}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
