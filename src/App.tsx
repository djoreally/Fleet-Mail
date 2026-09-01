import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar, AppTab } from './components/Sidebar';
import { FleetModuleView, FleetModuleId } from './components/FleetModuleView';
import { EmailList } from './components/EmailList';
import { EmailDetail } from './components/EmailDetail';
import { ContactsView } from './components/ContactsView';
import { AIChatView } from './components/AIChatView';
import { SettingsView } from './components/SettingsView';
import { ComposeModal } from './components/ComposeModal';
import { ConfigModal } from './components/ConfigModal';
import { NotificationToast } from './components/NotificationToast';
import { AppShell } from './components/AppShell';
import { HomePage } from './components/public/HomePage';
import { SignInPage } from './components/auth/SignInPage';
import { SignUpPage } from './components/auth/SignUpPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { VehicleWorkspace } from './components/vehicles/VehicleWorkspace';
import { fleetFetch } from './lib/fleetApi';
import {
  EmailMessage,
  ChatMessage,
  SystemStatus,
  SendEmailPayload,
  PersonalizationSettings,
  Contact,
  ChatAttachment
} from './types';

function FleetWorkspaceApp({ onSignOut, userEmail, userName }: { onSignOut?: () => void; userEmail?: string; userName?: string }) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [currentTab, setCurrentTab] = useState<AppTab>('inbox');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeInbox, setActiveInbox] = useState<string>('moms@agentmail.to');
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileEmailOpen, setMobileEmailOpen] = useState(false);

  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [composeInitialData, setComposeInitialData] = useState<{ to?: string; subject?: string; body?: string }>({});
  const [isHelpConfigOpen, setIsHelpConfigOpen] = useState<boolean>(false);
  const [newIncomingNotification, setNewIncomingNotification] = useState<EmailMessage | null>(null);
  const knownEmailIdsRef = useRef<Set<string>>(new Set());

  const [settings, setSettings] = useState<PersonalizationSettings>({
    personalityFocus: 'Professional',
    importantEmailsOnly: true,
    dailyAIDigest: false,
    connectedAccounts: [
      { id: 'acc-1', name: 'AgentMail Active Inbox (Dots-3)', type: 'agentmail', email: 'moms@agentmail.to' },
      { id: 'acc-2', name: 'Work Email (Google)', type: 'google', email: 'user@company.com' },
      { id: 'acc-3', name: 'Personal Calendar (Outlook)', type: 'outlook', email: 'user@outlook.com' }
    ]
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome_ai',
      role: 'assistant',
      content: `Good morning! I'm your Fleet OS copilot powered by AtlasCloud and AgentMail. I am actively monitoring ${activeInbox}. You can ask me to summarize fleet requests, identify action items, or draft a response.`,
      timestamp: new Date().toISOString(),
      chips: ['Summarize Fleet Inbox', 'Draft Fleet Response', 'Check Urgent Requests']
    }
  ]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.defaultInbox || data.activeInbox) setActiveInbox(data.activeInbox || data.defaultInbox);
      }
    } catch (e) { console.warn('Failed to fetch status:', e); }
  };

  const fetchEmails = useCallback(async (isInitial = false) => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/agentmail/messages?inbox=${encodeURIComponent(activeInbox)}`);
      if (res.ok) {
        const data = await res.json();
        const incomingList: EmailMessage[] = data.messages || [];
        if (!isInitial && knownEmailIdsRef.current.size > 0) {
          const freshNewEmails = incomingList.filter(e => !knownEmailIdsRef.current.has(e.id) && e.from !== activeInbox);
          if (freshNewEmails.length > 0) setNewIncomingNotification(freshNewEmails[0]);
        }
        incomingList.forEach(e => knownEmailIdsRef.current.add(e.id));
        setEmails(incomingList);
        if ((isInitial || !selectedEmailId) && incomingList.length > 0) setSelectedEmailId(incomingList[0].id);
      }
    } catch (err) { console.error('Failed to fetch emails:', err); }
    finally { setIsRefreshing(false); }
  }, [activeInbox, selectedEmailId]);

  useEffect(() => { fetchStatus(); fetchContacts(); }, []);

  const fetchContacts = async () => {
    try {
      const res = await fleetFetch('/api/contacts');
      if (res.ok) { const data = await res.json(); setContacts(data.contacts || []); }
    } catch (e) { console.warn('Failed to fetch contacts:', e); }
  };

  const handleAddContact = async (payload: Partial<Contact>): Promise<boolean> => {
    try { const res = await fleetFetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (res.ok) { await fetchContacts(); return true; } return false; }
    catch (e) { console.error('Failed to add contact:', e); return false; }
  };
  const handleUpdateContact = async (id: string, payload: Partial<Contact>): Promise<boolean> => {
    try { const res = await fleetFetch(`/api/contacts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (res.ok) { await fetchContacts(); return true; } return false; }
    catch (e) { console.error('Failed to update contact:', e); return false; }
  };
  const handleDeleteContact = async (id: string): Promise<boolean> => {
    try { const res = await fleetFetch(`/api/contacts/${id}`, { method: 'DELETE' }); if (res.ok) { await fetchContacts(); return true; } return false; }
    catch (e) { console.error('Failed to delete contact:', e); return false; }
  };
  const handleExtractFromInbox = async (): Promise<number> => {
    try { const res = await fleetFetch('/api/contacts/extract-from-inbox', { method: 'POST' }); if (res.ok) { const data = await res.json(); await fetchContacts(); return data.addedCount || 0; } return 0; }
    catch (e) { console.error('Failed to extract contacts:', e); return 0; }
  };

  const handleComposeToContact = (email: string, name?: string) => { setComposeInitialData({ to: email, subject: name ? `Connecting with ${name}` : '', body: '' }); setIsComposeOpen(true); };
  const handleAskAIAboutContact = (contact: Contact) => {
    setCurrentTab('chat');
    handleSendChatMessage(`Draft a professional outreach and relationship update for ${contact.name} (${contact.email}) at ${contact.company || 'their organization'}${contact.role ? `, who serves as ${contact.role}` : ''}. Notes: "${contact.notes || 'Discuss recent project milestones and strategic alignment'}"`);
  };

  useEffect(() => { fetchEmails(true); const interval = setInterval(() => fetchEmails(false), 10000); return () => clearInterval(interval); }, [activeInbox, fetchEmails]);

  const handleSendEmail = async (payload: SendEmailPayload): Promise<boolean> => {
    try { const res = await fetch('/api/agentmail/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (res.ok) { await fetchEmails(false); return true; } return false; }
    catch (e) { console.error('Failed to send email:', e); return false; }
  };
  const handleSendReply = async (replyText: string, to: string, subject: string): Promise<boolean> => handleSendEmail({ inbox: activeInbox, to, subject, body: replyText });
  const handleUpdateEmailSummary = (emailId: string, summary: any) => setEmails(prev => prev.map(e => e.id === emailId ? { ...e, summary } : e));

  const handleSendChatMessage = async (text: string, attachments: ChatAttachment[] = []) => {
    const userMsg: ChatMessage = { id: `user_${Date.now()}`, role: 'user', content: text, timestamp: new Date().toISOString(), attachments };
    const newMessages = [...chatMessages, userMsg]; setChatMessages(newMessages); setIsChatLoading(true);
    const selectedEmail = emails.find(e => e.id === selectedEmailId) || null;
    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: apiMessages, contextInbox: activeInbox, activeEmail: selectedEmail, personality: settings.personalityFocus, attachments }) });
      if (!res.ok) { const errData = await res.json(); throw new Error(errData.error || 'Failed to get AI response'); }
      const data = await res.json();
      const assistantMsg: ChatMessage = { id: `ai_${Date.now()}`, role: 'assistant', content: String(data.content || '').replace(/```json:agent_action\s*[\s\S]*?\s*```/g, '').trim(), timestamp: new Date().toISOString(), emailDraft: data.emailDraft, actionProposal: data.actionProposal ? { ...data.actionProposal, state: 'ready' } : undefined };
      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { id: `err_${Date.now()}`, role: 'assistant', content: `I couldn't complete that request safely. ${err?.message || 'Please try again.'}`, timestamp: new Date().toISOString() }]);
    } finally { setIsChatLoading(false); }
  };

  const handleConfirmAgentAction = async (messageId: string, confirmationToken: string) => {
    setChatMessages(messages => messages.map(message => message.id === messageId && message.actionProposal ? { ...message, actionProposal: { ...message.actionProposal, state: 'executing', error: undefined } } : message));
    try {
      const response = await fetch('/api/agent/actions/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmationToken, confirmed: true }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'The action could not be executed');
      setChatMessages(messages => messages.map(message => message.id === messageId && message.actionProposal ? { ...message, actionProposal: { ...message.actionProposal, state: 'executed' } } : message));
      if (body.kind === 'email.send') await fetchEmails(false);
    } catch (error) {
      setChatMessages(messages => messages.map(message => message.id === messageId && message.actionProposal ? { ...message, actionProposal: { ...message.actionProposal, state: 'failed', error: error instanceof Error ? error.message : 'The action failed' } } : message));
    }
  };

  const handleSendAndScheduleDraft = async (draft: { to: string; subject: string; body: string }) => {
    const success = await handleSendEmail({ inbox: activeInbox, to: draft.to, subject: draft.subject, body: draft.body });
    if (success) setChatMessages(prev => [...prev, { id: `conf_${Date.now()}`, role: 'assistant', content: `Email dispatched to ${draft.to}. No calendar event was created; calendar writes require a separate reviewed confirmation.`, timestamp: new Date().toISOString() }]);
  };
  const handleAskAIAboutEmail = (email: EmailMessage) => { setCurrentTab('chat'); handleSendChatMessage(`Analyze this email from ${email.fromName || email.from} with subject "${email.subject}" and prepare response action items.`); };

  const displayedEmails = emails.filter(email => {
    if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); const fromStr = (email.fromName || email.from || '').toLowerCase(); const subjStr = (email.subject || '').toLowerCase(); const bodyStr = (email.text || '').toLowerCase(); if (!fromStr.includes(q) && !subjStr.includes(q) && !bodyStr.includes(q)) return false; }
    const isSent = (email.from && email.from.toLowerCase().includes(activeInbox.toLowerCase())) || email.labels?.includes('sent') || email.id.startsWith('msg_sent_');
    if (currentTab === 'sent') return isSent;
    if (currentTab === 'drafts') return email.labels?.includes('draft');
    return !isSent;
  });
  const selectedEmail = emails.find(e => e.id === selectedEmailId) || displayedEmails[0] || null;
  const inboxCount = emails.filter(e => { const isSent = (e.from && e.from.toLowerCase().includes(activeInbox.toLowerCase())) || e.labels?.includes('sent') || e.id.startsWith('msg_sent_'); return !isSent && !e.read; }).length;
  const sentCount = emails.filter(e => (e.from && e.from.toLowerCase().includes(activeInbox.toLowerCase())) || e.labels?.includes('sent') || e.id.startsWith('msg_sent_')).length;
  const draftsCount = 0;

  return (
    <div className="h-[100dvh] w-full flex bg-white text-slate-900 overflow-hidden font-sans select-none antialiased">
      {mobileNavOpen && <button aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1px] lg:hidden" />}
      <Sidebar currentTab={currentTab} onSelectTab={tab => setCurrentTab(tab)} inboxCount={inboxCount} sentCount={sentCount} draftsCount={draftsCount} contactsCount={contacts.length} onOpenCompose={() => { setComposeInitialData({}); setIsComposeOpen(true); }} userEmail={userEmail || activeInbox} userName={userName || userEmail?.split('@')[0] || 'Fleet User'} onSignOut={onSignOut} mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="min-w-0 flex-1 flex flex-col h-full overflow-hidden bg-white">
        <Header searchQuery={searchQuery} onSearchChange={q => setSearchQuery(q)} unreadNotificationsCount={inboxCount} onOpenHelp={() => setIsHelpConfigOpen(true)} onOpenSettings={() => setCurrentTab('settings')} pageTitle={currentTab === 'contacts' ? 'Contacts' : currentTab === 'settings' ? 'Settings' : currentTab === 'prospects' ? 'Prospects' : undefined} userAvatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" onOpenMenu={() => setMobileNavOpen(true)} />
        <div className="flex-1 flex overflow-hidden">
          {(currentTab === 'inbox' || currentTab === 'sent' || currentTab === 'drafts') && <div className="flex-1 flex w-full h-full min-w-0 overflow-hidden"><div className={`${mobileEmailOpen ? 'hidden' : 'flex'} h-full w-full md:flex md:w-auto`}><EmailList emails={displayedEmails} selectedEmailId={selectedEmailId} onSelectEmail={email => { setSelectedEmailId(email.id); setMobileEmailOpen(true); setEmails(prev => prev.map(e => e.id === email.id ? { ...e, read: true } : e)); }} folderTitle={currentTab === 'inbox' ? 'Inbox' : currentTab === 'sent' ? 'Sent' : 'Drafts'} onRefresh={() => fetchEmails(false)} isRefreshing={isRefreshing} activeInbox={activeInbox} /></div><div className={`${mobileEmailOpen ? 'flex' : 'hidden'} min-w-0 flex-1 md:flex`}><EmailDetail email={selectedEmail} onSendReply={handleSendReply} onAskAIAboutEmail={handleAskAIAboutEmail} onUpdateEmailSummary={handleUpdateEmailSummary} userAvatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" onBack={() => setMobileEmailOpen(false)} /></div></div>}
          {currentTab === 'contacts' && <ContactsView contacts={contacts} emails={emails} onAddContact={handleAddContact} onUpdateContact={handleUpdateContact} onDeleteContact={handleDeleteContact} onExtractFromInbox={handleExtractFromInbox} onComposeTo={handleComposeToContact} onAskAIAboutContact={handleAskAIAboutContact} />}
          {currentTab === 'chat' && <AIChatView messages={chatMessages} onSendMessage={handleSendChatMessage} isLoading={isChatLoading} onSendAndScheduleDraft={handleSendAndScheduleDraft} onConfirmAction={handleConfirmAgentAction} userAvatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" />}
          {currentTab === 'settings' && <SettingsView settings={settings} onSaveSettings={newSettings => setSettings(newSettings)} onCancel={() => setCurrentTab('inbox')} />}
          {currentTab === 'vehicles' && <VehicleWorkspace />}
          {(['work-orders','maintenance','schedule','dispatch','parts','prospects','customers','financials','documents'] as FleetModuleId[]).includes(currentTab as FleetModuleId) && <FleetModuleView module={currentTab as FleetModuleId} onOpenInbox={() => setCurrentTab('inbox')} />}
        </div>
      </div>
      <ComposeModal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} onSendEmail={handleSendEmail} initialTo={composeInitialData.to} initialSubject={composeInitialData.subject} initialBody={composeInitialData.body} activeInbox={activeInbox} contacts={contacts} />
      <ConfigModal isOpen={isHelpConfigOpen} onClose={() => setIsHelpConfigOpen(false)} status={status} />
      <NotificationToast incomingEmail={newIncomingNotification} onView={email => { setSelectedEmailId(email.id); setNewIncomingNotification(null); setCurrentTab('inbox'); }} onDismiss={() => setNewIncomingNotification(null)} />
    </div>
  );
}

function LoadingScreen() {
  return <main className="grid min-h-screen place-items-center bg-[#07101f] text-white"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300"/><p className="mt-4 text-sm text-slate-400">Opening Fleet OS…</p></div></main>;
}

export default function App() {
  return <AppShell
    home={({ navigate, isAuthenticated, signOut }) => isAuthenticated ? <FleetWorkspaceApp onSignOut={() => void signOut()} /> : <HomePage onNavigate={navigate} />}
    signIn={({ navigate, refreshSession }) => <SignInPage onNavigate={path => path === '/app' ? void refreshSession().then(() => navigate('/app')) : navigate(path)} />}
    signUp={({ navigate, refreshSession }) => <SignUpPage onNavigate={path => path === '/app' ? void refreshSession().then(() => navigate('/app')) : navigate(path)} />}
    forgotPassword={({ navigate }) => <ForgotPasswordPage onNavigate={navigate} />}
    resetPassword={({ navigate }) => <ResetPasswordPage onNavigate={navigate} />}
    app={({ signOut, user }) => <FleetWorkspaceApp onSignOut={() => void signOut()} userEmail={user?.email} userName={user?.name} />}
    loading={<LoadingScreen />}
  />;
}
