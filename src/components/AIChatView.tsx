import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Bot, Calendar, FileText, Image as ImageIcon, Mic, MicOff, MoreVertical, Send, XCircle } from 'lucide-react';
import { ChatMessage, type ChatAttachment } from '../types';
import { AgentSkillsPanel } from './AgentSkillsPanel';

interface AIChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, attachments?: ChatAttachment[]) => void;
  isLoading: boolean;
  onSendAndScheduleDraft: (draft: { to: string; subject: string; body: string }) => void;
  onConfirmAction: (messageId: string, confirmationToken: string) => void;
  userAvatar?: string;
}

const MAX_FILES = 4;
const MAX_BYTES = 3_000_000;
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const supported = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'text/plain', 'text/csv', 'text/markdown', 'application/json',
  'application/pdf', DOCX,
]);

function inferredType(file: File) {
  if (file.type) return file.type;
  if (/\.pdf$/i.test(file.name)) return 'application/pdf';
  if (/\.docx$/i.test(file.name)) return DOCX;
  if (/\.csv$/i.test(file.name)) return 'text/csv';
  if (/\.json$/i.test(file.name)) return 'application/json';
  if (/\.md$/i.test(file.name)) return 'text/markdown';
  if (/\.txt$/i.test(file.name)) return 'text/plain';
  return 'application/octet-stream';
}

function dataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read attachment'));
    reader.readAsDataURL(file);
  });
}

export const AIChatView: React.FC<AIChatViewProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onSendAndScheduleDraft,
  onConfirmAction,
  userAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
}) => {
  const [inputText, setInputText] = useState('');
  const [showSkills, setShowSkills] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);
  useEffect(() => () => recognitionRef.current?.stop?.(), []);

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (isLoading || (!inputText.trim() && !attachments.length)) return;
    onSendMessage(inputText.trim() || 'Please analyze the attached file.', attachments);
    setInputText('');
    setAttachments([]);
    setAttachmentError('');
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setAttachmentError('');
    const room = Math.max(0, MAX_FILES - attachments.length);
    const selected = Array.from(files).slice(0, room);
    const totalBytes = attachments.reduce((sum, file) => sum + file.size, 0) + selected.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_BYTES) return setAttachmentError('Attachments must total 3 MB or less.');

    const invalid = selected.find((file) => !supported.has(inferredType(file)));
    if (invalid) return setAttachmentError('Use PNG, JPG, WebP, GIF, PDF, DOCX, TXT, CSV, JSON, or Markdown files.');

    try {
      const next = await Promise.all(selected.map(async (file): Promise<ChatAttachment> => {
        const type = inferredType(file);
        const kind = type.startsWith('image/') ? 'image' as const : 'document' as const;
        const item: ChatAttachment = { id: crypto.randomUUID(), name: file.name.slice(0, 180), type, size: file.size, kind };
        if (kind === 'image' || type === 'application/pdf' || type === DOCX) item.dataUrl = await dataUrl(file);
        else item.text = (await file.text()).slice(0, 50_000);
        return item;
      }));
      setAttachments((current) => [...current, ...next].slice(0, MAX_FILES));
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'Could not read attachment.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleDictation = () => {
    if (isListening) { recognitionRef.current?.stop(); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return setAttachmentError('Voice input is not supported in this browser.');
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    let committed = inputText;
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = String(event.results[index][0].transcript || '').trim();
        if (event.results[index].isFinal) committed = `${committed}${committed ? ' ' : ''}${transcript}`;
        else interim += `${transcript} `;
      }
      setInputText(`${committed}${interim ? ` ${interim.trim()}` : ''}`);
    };
    recognition.onerror = (event: any) => setAttachmentError(event.error === 'not-allowed' ? 'Microphone permission was not granted.' : 'Voice input stopped unexpectedly.');
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  return (
    <div id="ai-chat-view-container" className="flex h-full flex-1 flex-col overflow-hidden bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">AI Assistant</h2>
          <p className="text-xs text-slate-500">Fleet, inbox, documents and operations in one workspace</p>
        </div>
        <button type="button" title="Agent skills" onClick={() => setShowSkills((value) => !value)} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6 md:p-8">
        {showSkills && <AgentSkillsPanel />}
        <div className="flex justify-center"><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Today</span></div>

        {messages.map((message) => {
          const user = message.role === 'user';
          return (
            <div key={message.id} className={`flex max-w-3xl items-start gap-3 ${user ? 'ml-auto justify-end' : ''}`}>
              {!user && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0b57d0] text-white"><Bot className="h-5 w-5" /></div>}
              <div className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${user ? 'rounded-tr-sm bg-slate-900 text-white' : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800'}`}>
                <div className="whitespace-pre-wrap">{message.content}</div>
                {!!message.attachments?.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.attachments.map((file) => <span key={file.id} className={`inline-flex max-w-56 items-center gap-1 rounded-lg px-2 py-1 text-xs ${user ? 'bg-white/10' : 'bg-slate-100'}`}>{file.kind === 'image' ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}<span className="truncate">{file.name}</span></span>)}
                  </div>
                )}

                {!user && message.emailDraft && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Draft to {message.emailDraft.to}</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm">{message.emailDraft.body}</div>
                    <button type="button" onClick={() => onSendAndScheduleDraft(message.emailDraft!)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#0b57d0] px-3 py-2 text-xs font-semibold text-white"><Send className="h-3.5 w-3.5" />Use draft</button>
                  </div>
                )}

                {!user && message.actionProposal && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-slate-900">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Review required</div>
                    <div className="mt-1 font-semibold">{message.actionProposal.proposal.summary}</div>
                    <div className="mt-1 text-xs text-slate-600">Nothing changes until you confirm.</div>
                    {message.actionProposal.error && <div className="mt-2 text-xs font-medium text-red-700">{message.actionProposal.error}</div>}
                    <div className="mt-3 flex justify-end">
                      {message.actionProposal.state === 'executed' ? <span className="text-xs font-bold text-emerald-700">Executed</span> : (
                        <button type="button" disabled={message.actionProposal.state === 'executing'} onClick={() => onConfirmAction(message.id, message.actionProposal!.confirmationToken)} className="rounded-lg bg-[#0b57d0] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                          {message.actionProposal.state === 'executing' ? 'Executing…' : 'Confirm action'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {!user && message.calendarInvite && <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600"><Calendar className="h-4 w-4" />{message.calendarInvite.title}: {message.calendarInvite.time}</div>}
              </div>
              {user && <img src={userAvatar} alt="User" className="mt-1 h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover" />}
            </div>
          );
        })}

        {isLoading && <div className="flex items-center gap-3 text-xs text-slate-500"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b57d0] text-white"><Bot className="h-5 w-5 animate-pulse" /></div>Fleet OS is analyzing the request…</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 space-y-3 border-t border-slate-200 bg-white p-4 md:p-6">
        {!!attachments.length && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {attachments.map((file) => (
              <div key={file.id} className="relative flex min-w-36 max-w-56 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                {file.kind === 'image' && file.dataUrl ? <img src={file.dataUrl} alt="" className="h-9 w-9 rounded-md object-cover" /> : <FileText className="h-5 w-5 shrink-0 text-slate-500" />}
                <div className="min-w-0"><div className="truncate text-xs font-medium text-slate-700">{file.name}</div><div className="text-[10px] text-slate-400">{Math.ceil(file.size / 1024)} KB</div></div>
                <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments((current) => current.filter((item) => item.id !== file.id))} className="absolute -right-1.5 -top-1.5 rounded-full bg-white text-slate-500 shadow"><XCircle className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
        {attachmentError && <p className="text-xs font-medium text-red-600">{attachmentError}</p>}

        <form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm focus-within:border-slate-300 focus-within:bg-white">
          <input ref={fileInputRef} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv,text/markdown,application/json,.md,.txt,.csv,.json,.pdf,.docx" onChange={(event) => void addFiles(event.target.files)} className="hidden" />
          <button type="button" aria-label="Attach files" onClick={() => fileInputRef.current?.click()} disabled={attachments.length >= MAX_FILES || isLoading} className="rounded-xl p-2 text-slate-500 hover:bg-slate-200 disabled:opacity-40"><FileText className="h-5 w-5" /></button>
          <textarea value={inputText} onChange={(event) => setInputText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} rows={1} placeholder="Ask Fleet OS anything…" className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400" />
          <button type="button" aria-label={isListening ? 'Stop voice input' : 'Start voice input'} onClick={toggleDictation} className={`rounded-xl p-2 ${isListening ? 'bg-red-50 text-red-600' : 'text-slate-500 hover:bg-slate-200'}`}>{isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
          <button type="submit" aria-label="Send message" disabled={isLoading || (!inputText.trim() && !attachments.length)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0b57d0] text-white transition-colors hover:bg-[#0848b0] disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp className="h-5 w-5" /></button>
        </form>
        <p className="text-center text-[10px] text-slate-400">Up to 4 files / 3 MB total. PDF and DOCX text is extracted server-side before AI analysis.</p>
      </div>
    </div>
  );
};
