import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Bell,
  ArrowLeftRight,
  Mail,
  Calendar,
  Trash2,
  Plus,
  Check,
  Bot,
  ShieldCheck,
  Zap,
  Database
} from 'lucide-react';
import { PersonalizationSettings, ConnectedAccount } from '../types';
import { NeonDatabasePanel } from './NeonDatabasePanel';

interface SettingsViewProps {
  settings: PersonalizationSettings;
  onSaveSettings: (newSettings: PersonalizationSettings) => void;
  onCancel?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onCancel
}) => {
  const [personality, setPersonality] = useState<'Professional' | 'Friendly' | 'Concise'>(
    settings.personalityFocus || 'Professional'
  );
  const [importantOnly, setImportantOnly] = useState<boolean>(
    settings.importantEmailsOnly ?? true
  );
  const [dailyDigest, setDailyDigest] = useState<boolean>(
    settings.dailyAIDigest ?? false
  );
  const [accounts, setAccounts] = useState<ConnectedAccount[]>(
    settings.connectedAccounts || [
      {
        id: 'acc-1',
        name: 'Work Email (Google)',
        type: 'google',
        email: 'user@company.com'
      },
      {
        id: 'acc-2',
        name: 'Personal Calendar (Outlook)',
        type: 'outlook',
        email: 'user@outlook.com'
      },
      {
        id: 'acc-3',
        name: 'AgentMail Live Inbox (AtlasCloud Dots-3)',
        type: 'agentmail',
        email: 'moms@agentmail.to'
      }
    ]
  );
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccEmail, setNewAccEmail] = useState('');
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [google, setGoogle] = useState<{ configured: boolean; connected: boolean; account?: { email: string; name?: string } } | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  const loadGoogleStatus = async () => {
    try {
      const response = await fetch('/api/google/status');
      const data = await response.json();
      setGoogle(data);
    } catch {
      setGoogle({ configured: false, connected: false });
    }
  };

  useEffect(() => { void loadGoogleStatus(); }, []);

  const disconnectGoogle = async () => {
    setGoogleBusy(true);
    try {
      await fetch('/api/google/disconnect', { method: 'POST' });
      await loadGoogleStatus();
    } finally { setGoogleBusy(false); }
  };

  const handleSave = () => {
    onSaveSettings({
      personalityFocus: personality,
      importantEmailsOnly: importantOnly,
      dailyAIDigest: dailyDigest,
      connectedAccounts: accounts
    });
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2500);
  };

  const handleDeleteAccount = (id: string) => {
    setAccounts(accounts.filter((a) => a.id !== id));
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim() || !newAccEmail.trim()) return;

    setAccounts([
      ...accounts,
      {
        id: `acc-${Date.now()}`,
        name: newAccName.trim(),
        type: 'custom',
        email: newAccEmail.trim()
      }
    ]);
    setNewAccName('');
    setNewAccEmail('');
    setIsAddAccountModalOpen(false);
  };

  return (
    <div id="settings-view-container" className="flex-1 bg-white flex flex-col h-full overflow-y-auto select-none">
      <div className="max-w-5xl w-full mx-auto p-6 md:p-10 space-y-8">
        {/* Title Section */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            AI Personalization
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Customize how your AI assistant interacts and manages your communications.
          </p>
        </div>

        {/* Top 2 Cards: AI Personality Focus & Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Card 1: AI Personality Focus (Takes 8 cols) */}
          <div className="lg:col-span-8 p-6 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base">
              <Sparkles className="w-5 h-5 text-[#0b57d0]" />
              <span>AI Personality Focus</span>
            </div>
            <p className="text-xs text-slate-500">
              Select the default tone and style for AI-generated responses and summaries.
            </p>

            {/* 3 Tone Option Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {/* Professional */}
              <div
                id="tone-opt-professional"
                onClick={() => setPersonality('Professional')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  personality === 'Professional'
                    ? 'border-[#0b57d0] bg-[#e8f0fe] ring-1 ring-[#0b57d0]'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 bg-white'
                }`}
              >
                <p className={`text-sm font-bold ${
                  personality === 'Professional' ? 'text-[#0b57d0]' : 'text-slate-900'
                }`}>
                  Professional
                </p>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Formal, structured, and objective language.
                </p>
              </div>

              {/* Friendly */}
              <div
                id="tone-opt-friendly"
                onClick={() => setPersonality('Friendly')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  personality === 'Friendly'
                    ? 'border-[#0b57d0] bg-[#e8f0fe] ring-1 ring-[#0b57d0]'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 bg-white'
                }`}
              >
                <p className={`text-sm font-bold ${
                  personality === 'Friendly' ? 'text-[#0b57d0]' : 'text-slate-900'
                }`}>
                  Friendly
                </p>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Warm, approachable, and empathetic tone.
                </p>
              </div>

              {/* Concise */}
              <div
                id="tone-opt-concise"
                onClick={() => setPersonality('Concise')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  personality === 'Concise'
                    ? 'border-[#0b57d0] bg-[#e8f0fe] ring-1 ring-[#0b57d0]'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 bg-white'
                }`}
              >
                <p className={`text-sm font-bold ${
                  personality === 'Concise' ? 'text-[#0b57d0]' : 'text-slate-900'
                }`}>
                  Concise
                </p>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Direct, brief, focusing strictly on facts.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Notifications (Takes 4 cols) */}
          <div className="lg:col-span-4 p-6 rounded-2xl border border-slate-200 bg-white space-y-5 shadow-xs">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base">
              <Bell className="w-5 h-5 text-[#0b57d0]" />
              <span>Notifications</span>
            </div>

            <div className="space-y-4">
              {/* Toggle 1: Important Emails Only */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Important Emails Only
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    AI filters non-essential alerts.
                  </p>
                </div>
                <button
                  type="button"
                  id="toggle-important-emails"
                  onClick={() => setImportantOnly(!importantOnly)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 shrink-0 ${
                    importantOnly ? 'bg-[#0b57d0]' : 'bg-slate-200'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      importantOnly ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle 2: Daily AI Digest */}
              <div className="flex items-start justify-between gap-3 pt-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Daily AI Digest
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Receive a morning summary.
                  </p>
                </div>
                <button
                  type="button"
                  id="toggle-daily-digest"
                  onClick={() => setDailyDigest(!dailyDigest)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 shrink-0 ${
                    dailyDigest ? 'bg-[#0b57d0]' : 'bg-slate-200'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      dailyDigest ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Neon Database & Auth Quickstart */}
        <NeonDatabasePanel />

        <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#0b57d0]" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Google Workspace</p>
                <p className="text-xs text-slate-500 mt-1">
                  {google?.connected
                    ? `${google.account?.email || 'Google account'} · Gmail and Calendar connected`
                    : 'Connect Gmail and Google Calendar with one secure authorization.'}
                </p>
                {google?.connected && <span className="inline-flex mt-2 items-center gap-1 text-[11px] font-semibold text-emerald-700"><ShieldCheck className="w-3.5 h-3.5" />Encrypted connection active</span>}
                {google && !google.configured && <p className="text-[11px] text-amber-700 mt-2">Google OAuth environment variables are incomplete.</p>}
              </div>
            </div>
            {google?.connected ? (
              <button type="button" disabled={googleBusy} onClick={disconnectGoogle} className="px-4 py-2 rounded-xl text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50">Disconnect</button>
            ) : (
              <a href="/api/google/oauth/start" aria-disabled={!google?.configured} className={`px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#0b57d0] hover:bg-[#0848b0] text-center ${!google?.configured ? 'opacity-50 pointer-events-none' : ''}`}>Connect Google</a>
            )}
          </div>
        </div>

        {/* Card 4: Connected Accounts */}
        <div className="p-6 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base">
              <ArrowLeftRight className="w-5 h-5 text-[#0b57d0]" />
              <span>Connected Accounts</span>
            </div>
            <button
              id="add-account-btn"
              onClick={() => setIsAddAccountModalOpen(true)}
              className="text-xs font-semibold text-[#0b57d0] hover:text-[#0848b0] transition-colors cursor-pointer"
            >
              Add Account
            </button>
          </div>

          {/* Account Rows */}
          <div className="divide-y divide-slate-100">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="py-3.5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600">
                    {acc.type === 'outlook' ? (
                      <Calendar className="w-4 h-4 text-slate-700" />
                    ) : (
                      <Mail className="w-4 h-4 text-slate-700" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {acc.name}
                    </p>
                    <p className="text-xs text-slate-500 font-mono">
                      {acc.email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteAccount(acc.id)}
                  title="Remove account"
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Save & Cancel Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            id="settings-cancel-btn"
            onClick={onCancel}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
          >
            Cancel
          </button>
          <button
            id="settings-save-btn"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-[#0b57d0] hover:bg-[#0848b0] shadow-xs transition-colors cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {showSavedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-semibold animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Personalization preferences saved successfully!</span>
        </div>
      )}

      {/* Add Account Modal */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Connect New Account
            </h3>
            <form onSubmit={handleAddAccount} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Enterprise Exchange or Google Workspace"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#0b57d0]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="user@domain.com"
                  value={newAccEmail}
                  onChange={(e) => setNewAccEmail(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#0b57d0]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddAccountModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#0b57d0] hover:bg-[#0848b0]"
                >
                  Connect Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
