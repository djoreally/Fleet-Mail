import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  ArrowUp,
  Plus,
  MoreVertical,
  Calendar,
  Send,
  FileText,
  Clock,
  Sparkles,
  Search
} from 'lucide-react';
import { ChatMessage } from '../types';
import { AgentSkillsPanel } from './AgentSkillsPanel';

interface AIChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  onSendAndScheduleDraft: (draft: { to: string; subject: string; body: string }) => void;
  onConfirmAction: (messageId: string, confirmationToken: string) => void;
  userAvatar?: string;
}

export const AIChatView: React.FC<AIChatViewProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onSendAndScheduleDraft,
  onConfirmAction,
  userAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
}) => {
  const [inputText, setInputText] = useState('');
  const [showSkills, setShowSkills] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleChipClick = (chipText: string) => {
    onSendMessage(chipText);
  };

  return (
    <div id="ai-chat-view-container" className="flex-1 bg-white flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          AI Assistant
        </h2>
        <button
          title="More actions"
          onClick={() => setShowSkills((value) => !value)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-5 md:space-y-6">
        {showSkills && <AgentSkillsPanel />}
        {/* Date Marker */}
        <div className="flex items-center justify-center">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Today
          </span>
        </div>

        {/* Message bubbles */}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          if (isUser) {
            return (
              <div key={msg.id} className="flex items-start justify-end gap-3 max-w-2xl ml-auto">
                <div className="bg-slate-900 text-white rounded-2xl rounded-tr-xs px-5 py-3.5 text-sm leading-relaxed shadow-sm font-normal">
                  {msg.content}
                </div>
                <img
                  src={userAvatar}
                  alt="User"
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0 mt-1"
                />
              </div>
            );
          }

          // Assistant Message
          return (
            <div key={msg.id} className="flex items-start gap-3 max-w-3xl">
              {/* Blue robot square avatar */}
              <div className="w-8 h-8 rounded-lg bg-[#0b57d0] text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
                <Bot className="w-5 h-5" />
              </div>

              <div className="space-y-3 flex-1">
                {/* Content Box */}
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-5 shadow-xs space-y-4">
                  <div className="text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-wrap">
                    {msg.content}
                  </div>

                  {/* Optional Quick Action Chips */}
                  {msg.chips && msg.chips.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {msg.chips.map((chip, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleChipClick(chip)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Structured Email Draft Card (if present) */}
                  {msg.emailDraft && (
                    <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 space-y-2.5">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Draft to: {msg.emailDraft.to || 'Design Team'}
                      </div>
                      <p className="text-sm text-slate-800 italic leading-relaxed">
                        &ldquo;{msg.emailDraft.body}&rdquo;
                      </p>
                    </div>
                  )}

                  {msg.actionProposal && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4" aria-label="Action awaiting confirmation">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Review required</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{msg.actionProposal.proposal.summary}</p>
                          <p className="mt-1 text-xs text-slate-600">The agent prepared this action but has not executed it.</p>
                        </div>
                        {msg.actionProposal.proposal.kind === 'calendar.create' ? <Calendar className="h-5 w-5 shrink-0 text-amber-700" /> : <Send className="h-5 w-5 shrink-0 text-amber-700" />}
                      </div>
                      {msg.actionProposal.error && <p className="mt-3 text-xs font-medium text-red-700">{msg.actionProposal.error}</p>}
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-amber-200 pt-3">
                        <span className="text-[11px] text-slate-500">Expires in 10 minutes</span>
                        {msg.actionProposal.state === 'executed' ? (
                          <span className="text-xs font-bold text-emerald-700">Executed</span>
                        ) : (
                          <button
                            type="button"
                            disabled={msg.actionProposal.state === 'executing'}
                            onClick={() => onConfirmAction(msg.id, msg.actionProposal!.confirmationToken)}
                            className="rounded-xl bg-[#0b57d0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0848b0] disabled:opacity-50"
                          >
                            {msg.actionProposal.state === 'executing' ? 'Executing…' : msg.actionProposal.proposal.kind === 'calendar.create' ? 'Confirm & create event' : 'Confirm & send email'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Calendar Sync & Schedule Button (if present) */}
                  {msg.calendarInvite && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span>{msg.calendarInvite.title}: {msg.calendarInvite.time}</span>
                      </div>

                      <button
                        onClick={() => {
                          if (msg.emailDraft) {
                            onSendAndScheduleDraft(msg.emailDraft);
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-[#0b57d0] hover:bg-[#0848b0] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        Send email only
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-3 max-w-md">
            <div className="w-8 h-8 rounded-lg bg-[#0b57d0] text-white flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 flex items-center gap-2 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#0b57d0] animate-ping"></span>
              <span>Fleet OS is analyzing the request...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Area */}
      <div className="p-4 md:p-6 border-t border-slate-200 bg-white shrink-0 space-y-3">
        {/* Quick Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleChipClick('Draft a fleet service scheduling update for the customer')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Draft Email</span>
          </button>
          <button
            onClick={() => handleChipClick('Schedule a 30-minute sync with the design team for tomorrow at 10 AM')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Schedule Meeting</span>
          </button>
          <button
            onClick={() => handleChipClick('Summarize all urgent unread emails in my inbox right now')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Summarize Inbox</span>
          </button>
          <button
            onClick={() => handleChipClick('Find latest document or email regarding Q3 OKRs and Strategy')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <span>Find Document</span>
          </button>
        </div>

        {/* Prompt Input Container */}
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <button
            type="button"
            title="Attach context or file"
            className="absolute left-3.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>

          <input
            id="chat-user-input"
            type="text"
            placeholder="Ask AI to draft, summarize, or organize..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full pl-12 pr-14 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0b57d0] focus:ring-2 focus:ring-blue-100 transition-all shadow-xs"
          />

          <button
            id="chat-send-btn"
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="absolute right-2.5 w-9 h-9 rounded-xl bg-[#0b57d0] hover:bg-[#0848b0] disabled:opacity-40 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </form>

        {/* Disclaimer */}
        <p className="text-center text-[11px] text-slate-400">
          AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
};
