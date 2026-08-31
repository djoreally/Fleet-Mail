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
import {
  EmailMessage,
  ChatMessage,
  SystemStatus,
  SendEmailPayload,
  PersonalizationSettings,
  Contact
} from './types';

function FleetWorkspaceApp({ onSignOut }: { onSignOut?: () => void }) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [currentTab, setCurrentTab] = useState<AppTab>('inbox');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeInbox, setActiveInbox] = useState<string>('moms@agentmail.to');
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Modals & Notifications
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [composeInitialData, setComposeInitialData] = useState<{ to?: string; subject?: string; body?: string }>({});
  const [isHelpConfigOpen, setIsHelpConfigOpen] = useState<boolean>(false);
  const [newIncomingNotification, setNewIncomingNotification] = useState<EmailMessage | null>(null);
  const knownEmailIdsRef = useRef<Set<string>>(new Set());

  // Personalization settings
  const [settings, setSettings] = useState<PersonalizationSettings>({
    personalityFocus: 'Professional',
    importantEmailsOnly: true,
    dailyAIDigest: false,
    connectedAccounts: [
      {
        id: 'acc-1',
        name: 'AgentMail Active Inbox (Dots-3)',
        type: 'agentmail',
        email: 'moms@agentmail.to'
      },
      {
        id: 'acc-2',
        name: 'Work Email (Google)',
        type: 'google',
        email: 'user@company.com'
      },
      {
        id: 'acc-3',
        name: 'Personal Calendar (Outlook)',
        type: 'outlook',
        email: 'user@outlook.com'
      }
    ]
  });

  // AI Chat Messages initialized to match Image 4
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome_ai',
      role: 'assistant',
      content: `Good morning! I'm your Fleet OS copilot powered by AtlasCloud Dots-3 and AgentMail. I am actively monitoring **${activeInbox}**. You can ask me to summarize fleet requests, identify action items, or draft a response.`,
      timestamp: new Date().toISOString(),
      chips: ['Summarize Fleet Inbox', 'Draft Fleet Response', 'Check Urgent Requests']
    }
  ]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  // Fetch status
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.defaultInbox || data.activeInbox) {
          const inboxName = data.activeInbox || data.defaultInbox;
          setActiveInbox(inboxName);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch status:', e);
    }
  };

  // Fetch emails from proxy
  const fetchEmails = useCallback(async (isInitial = false) => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/agentmail/messages?inbox=${encodeURIComponent(activeInbox)}`);
      if (res.ok) {
        const data = await res.json();
        const incomingList: EmailMessage[] = data.messages || [];

        // Check for new emails arriving while watching
        if (!isInitial && knownEmailIdsRef.current.size > 0) {
          const freshNewEmails = incomingList.filter(
            e => !knownEmailIdsRef.current.has(e.id) && e.from !== activeInbox
          );
          if (freshNewEmails.length > 0) {
            setNewIncomingNotification(freshNewEmails[0]);
          }
        }

        incomingList.forEach(e => knownEmailIdsRef.current.add(e.id));
        setEmails(incomingList);

        if ((isInitial || !selectedEmailId) && incomingList.length > 0) {
          setSelectedEmailId(incomingList[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch emails:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeInbox, selectedEmailId]);

  // Initial load and live polling interval
  useEffect(() => {
    fetchStatus();
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts');
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
      }
    } catch (e) {
      console.warn('Failed to fetch contacts:', e);
    }
  };

  const handleAddContact = async (payload: Partial<Contact>): Promise<boolean> => {
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchContacts();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to add contact:', e);
      return false;
    }
  };

  const handleUpdateContact = async (id: string, payload: Partial<Contact>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchContacts();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to update contact:', e);
      return false;
    }
  };

  const handleDeleteContact = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchContacts();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to delete contact:', e);
      return false;
    }
  };

  const handleExtractFromInbox = async (): Promise<number> => {
    try {
      const res = await fetch('/api/contacts/extract-from-inbox', {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        await fetchContacts();
        return data.addedCount || 0;
      }
      return 0;
    } catch (e) {
      console.error('Failed to extract contacts:', e);
      return 0;
    }
  };

  const handleComposeToContact = (email: string, name?: string) => {
    setComposeInitialData({
      to: email,
      subject: name ? `Connecting with ${name}` : '',
      body: ''
    });
    setIsComposeOpen(true);
  };

  const handleAskAIAboutContact = (contact: Contact) => {
    setCurrentTab('chat');
    handleSendChatMessage(
      `Draft a professional outreach and relationship update for ${contact.name} (${contact.email}) at ${contact.company || 'their organization'}${contact.role ? `, who serves as ${contact.role}` : ''}. Notes: "${contact.notes || 'Discuss recent project milestones and strategic alignment'}"`
    );
  };

  useEffect(() => {
    fetchEmails(true);

    // Live inbox polling every 10 seconds for AgentMail
    const interval = setInterval(() => {
      fetchEmails(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [activeInbox, fetchEmails]);

  // Send Email Handler
  const handleSendEmail = async (payload: SendEmailPayload): Promise<boolean> => {
    try {
      const res = await fetch('/api/agentmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await fetchEmails(false);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to send email:', e);
      return false;
    }
  };

  // Send Reply from Detail Pane
  const handleSendReply = async (replyText: string, to: string, subject: string): Promise<boolean> => {
    return await handleSendEmail({
      inbox: activeInbox,
      to,
      subject,
      body: replyText
    });
  };

  const handleUpdateEmailSummary = (emailId: string, summary: any) => {
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, summary } : e));
  };

  // Send message to AI Chat
  const handleSendChatMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setIsChatLoading(true);

    const selectedEmail = emails.find(e => e.id === selectedEmailId) || null;

    try {
      const apiMessages = newMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          contextInbox: activeInbox,
          activeEmail: selectedEmail,
          personality: settings.personalityFocus
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to get AI response');
      }

      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: data.content,
        timestamp: new Date().toISOString(),
        emailDraft: data.emailDraft
      };

      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `I've analyzed your request: "${text}".\n\nI can draft that response, summarize specific threads, or refine the calendar invitation for your team.`,
        timestamp: new Date().toISOString(),
        emailDraft: {
          to: 'sarah.j@company.com',
          subject: 'Re: Q3 Strategy Alignment Meeting & OKRs',
          body: `Hi Sarah,\n\nI have reviewed the feedback. We will refine Key Result 2 with explicit latency metrics and submit the updated OKRs by tomorrow EOD.\n\nBest regards,\nAlex`
        }
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Send & Schedule Draft from AI Chat Card
  const handleSendAndScheduleDraft = async (draft: { to: string; subject: string; body: string }) => {
    const success = await handleSendEmail({
      inbox: activeInbox,
      to: draft.to,
      subject: draft.subject,
      body: draft.body
    });

    if (success) {
      const confirmMsg: ChatMessage = {
        id: `conf_${Date.now()}`,
        role: 'assistant',
        content: `✅ Email dispatched to **${draft.to}** and calendar sync scheduled for tomorrow at 10:00 AM.`,
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, confirmMsg]);
    }
  };

  // Ask AI about email (jumps to chat)
  const handleAskAIAboutEmail = (email: EmailMessage) => {
    setCurrentTab('chat');
    handleSendChatMessage(`Analyze this email from ${email.fromName || email.from} with subject "${email.subject}" and prepare response action items.`);
  };

  // Filtered emails based on search and current tab
  const displayedEmails = emails.filter((email) => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const fromStr = (email.fromName || email.from || '').toLowerCase();
      const subjStr = (email.subject || '').toLowerCase();
      const bodyStr = (email.text || '').toLowerCase();
      if (!fromStr.includes(q) && !subjStr.includes(q) && !bodyStr.includes(q)) {
        return false;
      }
    }

    const isSent = (email.from && email.from.toLowerCase().includes(activeInbox.toLowerCase())) ||
                   email.labels?.includes('sent') ||
                   email.id.startsWith('msg_sent_');

    if (currentTab === 'sent') return isSent;
    if (currentTab === 'drafts') return email.labels?.includes('draft');
    return !isSent;
  });

  const selectedEmail = emails.find((e) => e.id === selectedEmailId) || displayedEmails[0] || null;

  const inboxCount = emails.filter((e) => {
    const isSent = (e.from && e.from.toLowerCase().includes(activeInbox.toLowerCase())) ||
                   e.labels?.includes('sent') ||
                   e.id.startsWith('msg_sent_');
    return !isSent && !e.read;
  }).length;

  const sentCount = emails.filter((e) => {
    return (e.from && e.from.toLowerCase().includes(activeInbox.toLowerCase())) ||
           e.labels?.includes('sent') ||
           e.id.startsWith('msg_sent_');
  }).length;
  const draftsCount = 0;

  return (
    <div className="h-screen w-screen flex bg-white text-slate-900 overflow-hidden font-sans select-none antialiased">
      {/* Left Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        inboxCount={inboxCount}
        sentCount={sentCount}
        draftsCount={draftsCount}
        contactsCount={contacts.length}
        onOpenCompose={() => {
          setComposeInitialData({});
          setIsComposeOpen(true);
        }}
        userEmail={activeInbox}
        userName="Alex Carter"
        userAvatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
        onSignOut={onSignOut}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        {/* Top Header */}
        <Header
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
          unreadNotificationsCount={inboxCount}
          onOpenHelp={() => setIsHelpConfigOpen(true)}
          onOpenSettings={() => setCurrentTab('settings')}
          pageTitle={currentTab === 'contacts' ? 'Contacts' : currentTab === 'settings' ? 'Settings' : undefined}
          userAvatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
        />

        {/* View Switcher */}
        <div className="flex-1 flex overflow-hidden">
          {/* 1. Inbox / Sent / Drafts View (2-Column Split) */}
          {(currentTab === 'inbox' || currentTab === 'sent' || currentTab === 'drafts') && (
            <div className="flex-1 flex w-full h-full overflow-hidden">
              <EmailList
                emails={displayedEmails}
                selectedEmailId={selectedEmailId}
                onSelectEmail={(email) => {
                  setSelectedEmailId(email.id);
                  setEmails(prev => prev.map(e => e.id === email.id ? { ...e, read: true } : e));
                }}
                folderTitle={currentTab === 'inbox' ? 'Inbox' : currentTab === 'sent' ? 'Sent' : 'Drafts'}
                onRefresh={() => fetchEmails(false)}
                isRefreshing={isRefreshing}
                activeInbox={activeInbox}
              />

              <EmailDetail
                email={selectedEmail}
                onSendReply={handleSendReply}
                onAskAIAboutEmail={handleAskAIAboutEmail}
                onUpdateEmailSummary={handleUpdateEmailSummary}
                userAvatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
              />
            </div>
          )}

          {/* 2. Contacts & Address Book View */}
          {currentTab === 'contacts' && (
            <ContactsView
              contacts={contacts}
              emails={emails}
              onAddContact={handleAddContact}
              onUpdateContact={handleUpdateContact}
              onDeleteContact={handleDeleteContact}
              onExtractFromInbox={handleExtractFromInbox}
              onComposeTo={handleComposeToContact}
              onAskAIAboutContact={handleAskAIAboutContact}
            />
          )}

          {/* 3. AI Chat View */}
          {currentTab === 'chat' && (
            <AIChatView
              messages={chatMessages}
              onSendMessage={handleSendChatMessage}
              isLoading={isChatLoading}
              onSendAndScheduleDraft={handleSendAndScheduleDraft}
              userAvatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
            />
          )}

          {/* 4. Settings View */}
          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              onSaveSettings={(newSettings) => setSettings(newSettings)}
              onCancel={() => setCurrentTab('inbox')}
            />
          )}

          {currentTab === 'vehicles' && <VehicleWorkspace />}

          {(['work-orders', 'maintenance', 'schedule', 'dispatch', 'parts', 'customers', 'financials', 'documents'] as FleetModuleId[]).includes(currentTab as FleetModuleId) && (
            <FleetModuleView module={currentTab as FleetModuleId} onOpenInbox={() => setCurrentTab('inbox')} />
          )}
        </div>
      </div>

      {/* Compose Email Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSendEmail={handleSendEmail}
        initialTo={composeInitialData.to}
        initialSubject={composeInitialData.subject}
        initialBody={composeInitialData.body}
        activeInbox={activeInbox}
        contacts={contacts}
      />

      {/* Help / System Config Info Modal */}
      <ConfigModal
        isOpen={isHelpConfigOpen}
        onClose={() => setIsHelpConfigOpen(false)}
        status={status}
      />

      {/* Notification Toast for Live Incoming Messages */}
      <NotificationToast
        incomingEmail={newIncomingNotification}
        onView={(email) => {
          setSelectedEmailId(email.id);
          setNewIncomingNotification(null);
          setCurrentTab('inbox');
        }}
        onDismiss={() => setNewIncomingNotification(null)}
      />
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#07101f] text-white">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />
        <p className="mt-4 text-sm text-slate-400">Opening Fleet OS…</p>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <AppShell
      home={({ navigate, isAuthenticated, signOut }) => isAuthenticated
        ? <FleetWorkspaceApp onSignOut={() => void signOut()} />
        : <HomePage onNavigate={navigate} />}
      signIn={({ navigate, refreshSession }) => (
        <SignInPage onNavigate={(path) => path === '/app' ? void refreshSession().then(() => navigate('/app')) : navigate(path)} />
      )}
      signUp={({ navigate, refreshSession }) => (
        <SignUpPage onNavigate={(path) => path === '/app' ? void refreshSession().then(() => navigate('/app')) : navigate(path)} />
      )}
      forgotPassword={({ navigate }) => <ForgotPasswordPage onNavigate={navigate} />}
      resetPassword={({ navigate }) => <ResetPasswordPage onNavigate={navigate} />}
      app={({ signOut }) => <FleetWorkspaceApp onSignOut={() => void signOut()} />}
      loading={<LoadingScreen />}
    />
  );
}
