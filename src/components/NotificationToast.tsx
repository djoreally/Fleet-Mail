import React from 'react';
import { Sparkles, X, Mail } from 'lucide-react';
import { EmailMessage } from '../types';

interface NotificationToastProps {
  incomingEmail: EmailMessage | null;
  onView: (email: EmailMessage) => void;
  onDismiss: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  incomingEmail,
  onView,
  onDismiss
}) => {
  if (!incomingEmail) return null;

  const sender = incomingEmail.fromName || incomingEmail.from.split('<')[0].replace(/"/g, '').trim();

  return (
    <div
      id="incoming-email-toast"
      className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-white border border-blue-200 rounded-2xl shadow-xl p-4 flex items-start gap-3.5 animate-bounce-short select-none"
    >
      <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0b57d0] shrink-0 mt-0.5">
        <Sparkles className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#0b57d0] uppercase tracking-wider">
            New Incoming Message
          </span>
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-700 p-0.5 rounded-md"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-xs font-bold text-slate-900 truncate mt-1">
          {sender}: {incomingEmail.subject}
        </p>

        {incomingEmail.summary ? (
          <p className="text-xs text-slate-600 mt-1 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
            &ldquo;{incomingEmail.summary.tldr}&rdquo;
          </p>
        ) : (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
            {incomingEmail.text}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => onView(incomingEmail)}
            className="px-3.5 py-1.5 rounded-lg bg-[#0b57d0] hover:bg-[#0848b0] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            View & Respond
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-medium transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
