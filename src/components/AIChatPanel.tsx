import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  User,
  Paperclip,
  CornerDownLeft,
  Copy,
  Check,
  MailCheck,
  FileEdit,
  ArrowRight,
  RefreshCw,
  Zap,
  ChevronDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, EmailMessage } from '../types';

interface AIChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  activeEmail: EmailMessage | null;
  onUseDraftInComposer: (draft: { to: string; subject: string; body: string }) => void;
  onSendDraftDirectly: (draft: { to: string; subject: string; body: string }) => void;
  activeInbox: string;
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  messages,
  onSendMessage,
  isLoading,
  activeEmail,
  onUseDraftInComposer,
  onSendDraftDirectly,
  activeInbox
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const promptSuggestions = activeEmail
    ? [
        `Draft a polite confirmation reply to ${activeEmail.from.split('<')[0]}`,
        `Summarize key deadlines and deliverables from this email`,
        `Draft a follow-up asking for more details`,
        `Generate 3 different response options (Accept, Counter-offer, Decline)`
      ]
    : [
        `Draft an email to client about our upcoming product launch`,
        `Write a polite follow-up on an overdue invoice`,
        `Draft a meeting invite for strategy sync next Tuesday`,
        `What can you help me with in moms@agentmail.to?`
      ];

  return (
    <div id="ai-chat-panel" className="w-full lg:w-[420px] bg-slate-900 border-l border-slate-800 flex flex-col h-full shrink-0">
      {/* Chat Header */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-white">Dots-3 Agent Copilot</h3>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                AtlasCloud
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {activeEmail ? (
                <span className="truncate max-w-[200px] inline-block align-bottom text-indigo-300">
                  Focus: {activeEmail.subject || 'Selected email'}
                </span>
              ) : (
                `Managing: ${activeInbox}`
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="p-4 text-center space-y-4 my-auto">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-200">Chat with Dots-3 Email AI</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Draft new emails, craft quick replies, polish tones, or summarize threads from <span className="font-mono text-slate-300">moms@agentmail.to</span>.
              </p>
            </div>

            {/* Starter Suggestion Chips */}
            <div className="space-y-1.5 pt-2 text-left">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                Suggested Prompts
              </p>
              {promptSuggestions.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(prompt)}
                  className="w-full text-left text-xs p-2.5 rounded-lg bg-slate-950/60 hover:bg-indigo-950/50 text-slate-300 hover:text-indigo-200 border border-slate-800 hover:border-indigo-500/30 transition-all flex items-center justify-between group"
                >
                  <span className="line-clamp-1">{prompt}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
              >
                {/* Role badge */}
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 px-1">
                  {isUser ? (
                    <>
                      <span>You</span>
                      <User className="w-3 h-3 text-indigo-400" />
                    </>
                  ) : (
                    <>
                      <Bot className="w-3 h-3 text-cyan-400" />
                      <span>Dots-3 AI</span>
                    </>
                  )}
                  <span className="text-slate-400 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[92%] ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/20'
                      : 'bg-slate-950/90 text-slate-200 rounded-tl-none border border-slate-800 shadow-sm'
                  }`}
                >
                  {isUser ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <div className="prose prose-invert prose-xs max-w-none space-y-2">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}

                  {/* If the message contains an Email Draft action card */}
                  {msg.emailDraft && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-indigo-500/40 space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                        <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1">
                          <MailCheck className="w-3.5 h-3.5 text-indigo-400" />
                          Ready-to-Send Email Draft
                        </span>
                      </div>

                      <div className="text-[11px] space-y-1 text-slate-300">
                        <p><span className="text-slate-400 font-medium">To:</span> <span className="font-mono text-slate-200">{msg.emailDraft.to}</span></p>
                        <p><span className="text-slate-400 font-medium">Subject:</span> <span className="text-slate-200 font-semibold">{msg.emailDraft.subject}</span></p>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => onUseDraftInComposer(msg.emailDraft!)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors"
                        >
                          <FileEdit className="w-3.5 h-3.5" />
                          <span>Open in Composer</span>
                        </button>
                        <button
                          onClick={() => onSendDraftDirectly(msg.emailDraft!)}
                          className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
                          title="Send immediately via AgentMail"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Now</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions below bubble */}
                {!isUser && (
                  <div className="flex items-center gap-2 px-1">
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex items-start gap-2 text-xs text-slate-400">
            <div className="w-7 h-7 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="bg-slate-950/80 p-3 rounded-xl rounded-tl-none border border-slate-800 flex items-center gap-2">
              <span className="animate-pulse font-medium text-slate-300">Dots-3 is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/90">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="relative">
            <textarea
              id="ai-chat-input"
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ask Dots-3 to draft, summarize, or edit an email..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pr-12 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none transition-colors"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="absolute right-2.5 bottom-3.5 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-600 transition-colors shadow-sm"
              title="Send message to Dots-3 AI"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 font-mono">
            <span>Shift + Enter for new line</span>
            <span>AtlasCloud dots-3-note</span>
          </div>
        </form>
      </div>
    </div>
  );
};
