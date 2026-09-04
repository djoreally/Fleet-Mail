import React, { useEffect, useState } from 'react';
import {
  Reply,
  MoreVertical,
  Sparkles,
  Paperclip,
  Send,
  Bold,
  Download,
  ArrowLeft
} from 'lucide-react';
import { EmailMessage, type EmailAttachment } from '../types';
import { fleetFetch } from '../lib/fleetApi';

interface EmailDetailProps {
  email: EmailMessage | null;
  onSendReply: (replyText: string, to: string, subject: string) => Promise<boolean>;
  onAskAIAboutEmail: (email: EmailMessage) => void;
  onSelectSuggestionChip?: (chipText: string) => void;
  onUpdateEmailSummary?: (emailId: string, summary: any) => void;
  userAvatar?: string;
  onBack?: () => void;
}

const sizeLabel = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const EmailDetail: React.FC<EmailDetailProps> = ({
  email,
  onSendReply,
  onAskAIAboutEmail,
  onSelectSuggestionChip,
  onUpdateEmailSummary,
  userAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  onBack
}) => {
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingSmartDraft, setIsGeneratingSmartDraft] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [downloadingId, setDownloadingId] = useState('');

  useEffect(() => {
    let cancelled = false;
    setAttachments([]);
    setAttachmentError('');
    if (!email?.id || !email.inbox_id) return;
    setAttachmentsLoading(true);
    void fleetFetch(`/api/agentmail/messages/${encodeURIComponent(email.id)}/attachments?inbox=${encodeURIComponent(email.inbox_id)}`)
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Attachments could not be loaded');
        if (!cancelled) setAttachments(Array.isArray(data.attachments) ? data.attachments : []);
      })
      .catch(error => { if (!cancelled) setAttachmentError(error instanceof Error ? error.message : 'Attachments could not be loaded'); })
      .finally(() => { if (!cancelled) setAttachmentsLoading(false); });
    return () => { cancelled = true; };
  }, [email?.id, email?.inbox_id]);

  if (!email) {
    return (
      <div id="email-detail-empty" className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-white">
        <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-4">
          <Sparkles className="w-8 h-8 text-[#0b57d0]/60" />
        </div>
        <h3 className="text-base font-semibold text-slate-700">Select an email to view</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1">Choose any conversation from your inbox to review smart summaries and AI-powered replies.</p>
      </div>
    );
  }

  const handleGenerateSummary = async () => {
    if (!email || isSummarizing) return;
    setIsSummarizing(true);
    try {
      const res = await fetch('/api/summarize-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.summary && onUpdateEmailSummary) onUpdateEmailSummary(email.id, data.summary);
      }
    } catch (e) { console.error('Failed to generate summary:', e); }
    finally { setIsSummarizing(false); }
  };

  const handleSend = async () => {
    if (!replyText.trim() || isSending) return;
    setIsSending(true);
    try {
      const rawFrom = email.from || '';
      const emailMatch = rawFrom.match(/<([^>]+)>/);
      const recipient = emailMatch ? emailMatch[1].trim() : rawFrom.trim();
      const subject = email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`;
      const success = await onSendReply(replyText, recipient, subject);
      if (success) setReplyText('');
    } finally { setIsSending(false); }
  };

  const handleSmartDraft = async (prompt?: string) => {
    setIsGeneratingSmartDraft(true);
    try {
      const promptInstruction = prompt || 'Draft a concise, professional reply acknowledging this email and confirming the next steps.';
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: `${promptInstruction}\n\nEmail Subject: ${email.subject}\nFrom: ${email.from}\nBody: ${email.text}` }], activeEmail: email })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.emailDraft?.body) setReplyText(data.emailDraft.body);
        else if (data.content) setReplyText(data.content.replace(/```[\s\S]*?```/g, '').trim());
      }
    } catch (e) { console.error('Smart draft error:', e); }
    finally { setIsGeneratingSmartDraft(false); }
  };

  const handleDownloadAttachment = async (attachment: EmailAttachment) => {
    if (!email.inbox_id || downloadingId) return;
    setDownloadingId(attachment.id);
    setAttachmentError('');
    try {
      const response = await fleetFetch(`/api/agentmail/messages/${encodeURIComponent(email.id)}/attachments/${encodeURIComponent(attachment.id)}?inbox=${encodeURIComponent(email.inbox_id)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Attachment could not be retrieved');
      const url = String(data.attachment?.downloadUrl || '');
      if (!/^https:\/\//i.test(url)) throw new Error('AgentMail did not return a valid attachment URL');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'Attachment could not be retrieved');
    } finally { setDownloadingId(''); }
  };

  const senderName = email.fromName || email.from.split('<')[0].replace(/"/g, '').trim();
  const senderEmail = email.from.includes('<') ? email.from.split('<')[1].replace('>', '') : email.from;
  const toList = Array.isArray(email.to) ? email.to.join(', ') : email.to;

  return (
    <div id="email-detail-pane" className="flex-1 bg-white flex flex-col h-full overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-5 md:space-y-6 flex-1 flex flex-col pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button onClick={onBack} className="-ml-2 inline-flex h-11 w-fit items-center gap-2 rounded-xl px-2 text-sm font-semibold text-blue-700 md:hidden"><ArrowLeft className="h-5 w-5" />Inbox</button>
        <div className="flex items-start justify-between gap-4">
          <h1 className="min-w-0 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight break-words">{email.subject || '(No Subject)'}</h1>
          <div className="flex items-center gap-3 shrink-0 pt-1">
            <span className="text-xs font-medium text-slate-500">{email.formattedTime || (email.created_at ? new Date(email.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}{email.relativeTime && ` (${email.relativeTime})`}</span>
            <button onClick={() => handleSmartDraft()} title="Reply" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"><Reply className="w-4 h-4" /></button>
            <button title="More actions" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"><MoreVertical className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <img src={email.avatarUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'} alt={senderName} className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-xs" />
          <div><div className="flex items-center gap-1.5"><span className="text-sm font-bold text-slate-900">{senderName}</span><span className="text-xs text-slate-500">&lt;{senderEmail}&gt;</span></div><p className="text-xs text-slate-500">To: <span className="text-slate-700">{toList || 'You'}</span></p></div>
        </div>

        {email.summary ? (
          <div id="ai-summary-card" className="bg-[#f0f6ff] border border-[#d2e3fc] rounded-2xl p-5 space-y-3.5">
            <div className="flex items-start gap-3"><div className="w-8 h-8 rounded-lg bg-blue-100/90 flex items-center justify-center text-[#0b57d0] shrink-0 mt-0.5 shadow-xs"><Sparkles className="w-4 h-4" /></div><div className="space-y-1"><div className="flex items-center justify-between"><h4 className="text-xs font-bold uppercase tracking-wider text-[#0b57d0]">AI Summary (Dots-3)</h4>{email.summary.urgency && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${email.summary.urgency === 'High' || email.summary.urgency === 'Critical' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-[#0b57d0]'}`}>{email.summary.urgency} Urgency</span>}</div><p className="text-sm text-slate-800 leading-relaxed font-normal">{email.summary.tldr}</p></div></div>
            {email.summary.suggestedReplies && email.summary.suggestedReplies.length > 0 && <div className="flex flex-wrap items-center gap-2 pt-1 pl-11">{email.summary.suggestedReplies.map((chip: string, idx: number) => <button key={idx} id={`summary-chip-${idx}`} onClick={() => { if (onSelectSuggestionChip) onSelectSuggestionChip(chip); handleSmartDraft(`Draft a reply based on: "${chip}"`); }} className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-xs hover:border-[#0b57d0]/40 transition-all cursor-pointer">{chip}</button>)}</div>}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"><div className="flex items-center gap-2.5"><Sparkles className="w-4 h-4 text-[#0b57d0]" /><span className="text-xs text-slate-600 font-medium">Summarize this conversation with Dots-3 AI</span></div><button onClick={handleGenerateSummary} disabled={isSummarizing} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0b57d0] hover:bg-[#0848b0] text-white disabled:opacity-50 transition-colors shadow-xs">{isSummarizing ? 'Analyzing...' : 'Generate AI Summary'}</button></div>
        )}

        {(attachmentsLoading || attachments.length > 0 || attachmentError) && (
          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4" aria-label="Email attachments">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Paperclip className="h-4 w-4 text-slate-500" />Attachments{attachments.length > 0 ? ` (${attachments.length})` : ''}</div>
            {attachmentsLoading && <p className="mt-2 text-xs text-slate-500">Loading attachments…</p>}
            {!attachmentsLoading && attachments.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{attachments.map(attachment => <button key={attachment.id} type="button" onClick={() => void handleDownloadAttachment(attachment)} disabled={downloadingId === attachment.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xs transition hover:border-blue-300 hover:bg-blue-50/40 disabled:opacity-60"><span className="rounded-lg bg-blue-50 p-2 text-blue-600"><Paperclip className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{attachment.filename}</span><span className="block truncate text-[11px] text-slate-500">{[attachment.contentType, sizeLabel(attachment.size)].filter(Boolean).join(' · ')}</span></span><Download className="h-4 w-4 shrink-0 text-slate-400" /></button>)}</div>}
            {attachmentError && <p className="mt-2 text-xs font-medium text-red-600">{attachmentError}</p>}
          </section>
        )}

        <div className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap py-2 space-y-4 font-normal">{email.text}</div>

        <div className="mt-auto pt-6 border-t border-slate-200">
          <div className="border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden focus-within:border-[#0b57d0] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <div className="flex items-center gap-2 px-4 pt-3 text-xs text-slate-500"><img src={userAvatar} alt="Your Avatar" className="w-5 h-5 rounded-full object-cover border border-slate-200" /><span>Reply to {senderName}...</span></div>
            <textarea id="inline-reply-textarea" rows={3} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write your reply... (Tip: Type /ai for assistance)" className="w-full px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none resize-none bg-transparent" />
            <div className="px-4 py-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2"><button type="button" title="Bold text" className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors font-bold text-xs"><Bold className="w-4 h-4" /></button><button type="button" title="Attach file" className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"><Paperclip className="w-4 h-4" /></button><button id="inline-smart-draft-btn" type="button" onClick={() => handleSmartDraft()} disabled={isGeneratingSmartDraft} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0b57d0] hover:bg-blue-50 transition-colors"><Sparkles className={`w-3.5 h-3.5 ${isGeneratingSmartDraft ? 'animate-spin' : ''}`} /><span>{isGeneratingSmartDraft ? 'Generating Draft...' : 'Smart Draft'}</span></button></div>
              <button id="inline-send-btn" type="button" onClick={handleSend} disabled={!replyText.trim() || isSending} className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-[#0b57d0] hover:bg-[#0848b0] disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"><span>{isSending ? 'Sending...' : 'Send'}</span><Send className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
