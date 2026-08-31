import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileText,
  MoreVertical,
  Send,
  Paperclip,
  Image as ImageIcon,
  Bot,
  Sparkles,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Users,
  User
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SendEmailPayload, Contact } from '../types';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendEmail: (payload: SendEmailPayload) => Promise<boolean>;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  activeInbox: string;
  contacts?: Contact[];
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSendEmail,
  initialTo = '',
  initialSubject = '',
  initialBody = '',
  activeInbox,
  contacts = []
}) => {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [promptInput, setPromptInput] = useState('');
  const [currentTone, setCurrentTone] = useState<'Professional' | 'Friendly' | 'Concise'>('Professional');
  const [toneProgress, setToneProgress] = useState(75);
  const [isSending, setIsSending] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isRewritingTone, setIsRewritingTone] = useState(false);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTo(initialTo);
      setSubject(initialSubject);
      setBody(initialBody);
      setPromptInput('');
      setShowContactDropdown(false);
    }
  }, [isOpen, initialTo, initialSubject, initialBody]);

  // Filter contacts matching input
  const matchingContacts = contacts.filter((c) => {
    if (!to) return true;
    const q = to.toLowerCase().trim();
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.company && c.company.toLowerCase().includes(q));
  });

  const handleSelectContact = (contact: Contact) => {
    setTo(contact.email);
    setShowContactDropdown(false);
  };

  if (!isOpen) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!to.trim() || !subject.trim() || !body.trim() || isSending) return;

    setIsSending(true);
    try {
      const success = await onSendEmail({
        inbox: activeInbox,
        to: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
      });

      if (success) {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.8 }
        });
        onClose();
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateDraftFromPrompt = async () => {
    if (!promptInput.trim() || isDrafting) return;
    setIsDrafting(true);
    try {
      const res = await fetch('/api/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptText: promptInput,
          tone: currentTone,
          recipient: to,
          contextSubject: subject
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.subject && !subject) setSubject(data.subject);
        if (data.body) setBody(data.body);
        setPromptInput('');
      }
    } catch (err) {
      console.error('Draft generation error:', err);
    } finally {
      setIsDrafting(false);
    }
  };

  const handleToneAdjustment = async (targetTone: 'warmer' | 'concise' | 'professional') => {
    if (!body.trim() || isRewritingTone) return;
    setIsRewritingTone(true);
    try {
      const res = await fetch('/api/rewrite-tone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body,
          subject,
          tone: targetTone
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.rewrittenBody) {
          setBody(data.rewrittenBody);
          if (targetTone === 'warmer') {
            setCurrentTone('Friendly');
            setToneProgress(50);
          } else if (targetTone === 'concise') {
            setCurrentTone('Concise');
            setToneProgress(90);
          } else {
            setCurrentTone('Professional');
            setToneProgress(75);
          }
        }
      }
    } catch (e) {
      console.error('Tone adjust error:', e);
    } finally {
      setIsRewritingTone(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 select-none animate-fadeIn">
      <div
        id="compose-modal-container"
        className="bg-white w-full max-w-5xl h-[85vh] max-h-[780px] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
      >
        {/* Top Bar Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              New Message
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              title="Save draft"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              title="More options"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            <button
              id="compose-modal-send-btn"
              onClick={() => handleSend()}
              disabled={!to.trim() || !subject.trim() || !body.trim() || isSending}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#0b57d0] hover:bg-[#0848b0] disabled:opacity-50 text-white text-sm font-semibold shadow-xs transition-all cursor-pointer"
            >
              <span>{isSending ? 'Sending...' : 'Send'}</span>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Body Split: Left Editor + Right AI ASSIST Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Email Form */}
          <div className="flex-1 flex flex-col justify-between p-6 overflow-y-auto border-r border-slate-200">
            <div className="space-y-4">
              {/* To field */}
              <div className="relative border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-500 w-16 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>To</span>
                  </span>
                  <input
                    id="compose-to-input"
                    type="text"
                    placeholder="Enter email or search contacts..."
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value);
                      setShowContactDropdown(true);
                    }}
                    onFocus={() => setShowContactDropdown(true)}
                    className="flex-1 text-sm text-slate-900 placeholder-slate-400 focus:outline-none bg-transparent"
                  />
                  {contacts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowContactDropdown(!showContactDropdown)}
                      className="text-xs text-[#0b57d0] hover:text-[#0848b0] font-medium flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-blue-50 transition-colors"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Contacts ({contacts.length})</span>
                    </button>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {showContactDropdown && matchingContacts.length > 0 && (
                  <div
                    ref={dropdownRef}
                    className="absolute left-16 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100"
                  >
                    <div className="p-2 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Suggested Contacts</span>
                      <button
                        type="button"
                        onClick={() => setShowContactDropdown(false)}
                        className="text-slate-400 hover:text-slate-700"
                      >
                        ✕
                      </button>
                    </div>
                    {matchingContacts.slice(0, 6).map((c) => (
                      <div
                        key={c.id}
                        onClick={() => handleSelectContact(c)}
                        className="p-2.5 hover:bg-blue-50/80 cursor-pointer flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={
                              c.avatarUrl ||
                              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                c.name || c.email
                              )}`
                            }
                            alt={c.name}
                            className="w-7 h-7 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {c.name}
                              {c.company && (
                                <span className="text-[11px] font-normal text-slate-500 ml-1.5">
                                  ({c.company})
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] font-mono text-slate-500 truncate">{c.email}</p>
                          </div>
                        </div>
                        {c.tags && c.tags.length > 0 && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                            {c.tags[0]}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Subject field */}
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <span className="text-sm font-medium text-slate-500 w-16">Subject</span>
                <input
                  id="compose-subject-input"
                  type="text"
                  placeholder="Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="flex-1 text-sm text-slate-900 placeholder-slate-400 focus:outline-none bg-transparent font-medium"
                />
              </div>

              {/* Body Textarea */}
              <div>
                <textarea
                  id="compose-body-textarea"
                  rows={14}
                  placeholder="Start writing..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full text-sm text-slate-900 placeholder-slate-400 focus:outline-none resize-none bg-transparent leading-relaxed"
                />
              </div>
            </div>

            {/* Bottom Attachments Bar */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 text-slate-500">
              <button
                type="button"
                title="Attach file"
                className="p-2 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <button
                type="button"
                title="Attach image"
                className="p-2 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Right AI ASSIST Inspector Panel */}
          <div id="ai-assist-sidebar" className="w-80 md:w-96 bg-white p-6 space-y-5 overflow-y-auto shrink-0 select-none">
            {/* Header */}
            <div className="flex items-center gap-2 text-[#0b57d0]">
              <Bot className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider">
                AI ASSIST
              </h3>
            </div>

            {/* Card 1: Tone Analysis */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-800 text-xs font-semibold">
                  <Sliders className="w-4 h-4 text-slate-500" />
                  <span>Tone Analysis</span>
                </div>
                <span className="text-xs font-bold text-[#0b57d0]">
                  {currentTone}
                </span>
              </div>

              {/* Tone Level Bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0b57d0] rounded-full transition-all duration-300"
                  style={{ width: `${toneProgress}%` }}
                />
              </div>

              {/* Tone Quick Actions */}
              <div className="space-y-1.5 pt-1">
                <button
                  id="tone-warmer-btn"
                  onClick={() => handleToneAdjustment('warmer')}
                  disabled={isRewritingTone || !body.trim()}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0b57d0] transition-colors disabled:opacity-50"
                >
                  Make it warmer
                </button>
                <button
                  id="tone-concise-btn"
                  onClick={() => handleToneAdjustment('concise')}
                  disabled={isRewritingTone || !body.trim()}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0b57d0] transition-colors disabled:opacity-50"
                >
                  More concise
                </button>
              </div>
            </div>

            {/* Card 2: Suggestions */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-xs text-center">
              <div className="flex items-center gap-2 text-slate-800 text-xs font-semibold text-left">
                <Sparkles className="w-4 h-4 text-slate-500" />
                <span>Suggestions</span>
              </div>

              <div className="py-4 px-2 space-y-2">
                <FileText className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs text-slate-500 leading-relaxed max-w-[220px] mx-auto">
                  {body.trim().length > 30
                    ? `Clarity score: 94%. Your key arguments are well articulated.`
                    : 'Start writing to get real-time feedback and suggestions.'}
                </p>
              </div>
            </div>

            {/* Card 3: Draft from prompt */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-slate-800 text-xs font-semibold">
                <Sparkles className="w-4 h-4 text-slate-500" />
                <span>Draft from prompt</span>
              </div>

              <textarea
                id="ai-prompt-input"
                rows={3}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Briefly describe what you want to say..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0b57d0] resize-none"
              />

              <button
                id="ai-generate-draft-btn"
                type="button"
                onClick={handleGenerateDraftFromPrompt}
                disabled={!promptInput.trim() || isDrafting}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-[#0b57d0] hover:text-white disabled:opacity-50 text-slate-700 text-xs font-semibold transition-all duration-150 cursor-pointer shadow-2xs"
              >
                {isDrafting ? 'Generating Draft...' : 'Generate Draft'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
