import React from 'react';
import { X, KeyRound, Server, Mail, ShieldCheck, ExternalLink, Check, Copy } from 'lucide-react';
import { SystemStatus } from '../types';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SystemStatus | null;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  status
}) => {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn select-none">
      <div
        id="config-modal-card"
        className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-50 text-[#0b57d0]">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">API Integration & Services</h3>
              <p className="text-xs text-slate-500">AtlasCloud Dots-3 & AgentMail Specs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-600">
          {/* AtlasCloud Status Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#0b57d0]" />
                <span className="font-bold text-slate-900">AtlasCloud AI (Dots-3)</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                status?.atlasCloudConfigured
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {status?.atlasCloudConfigured ? 'CONNECTED' : 'ACTIVE / FALLBACK READY'}
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-mono">
              Model: <span className="text-[#0b57d0] font-semibold">dots-studio/dots-3-note-prev-free</span><br />
              Endpoint: <span className="text-slate-700">https://api.atlascloud.ai/v1/chat/completions</span>
            </p>

            <div className="pt-1 flex items-center justify-between text-xs">
              <span className="text-slate-500">Env: <code className="font-mono text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">ATLASCLOUD_API_KEY</code></span>
              <a
                href="https://console.atlascloud.ai"
                target="_blank"
                rel="noreferrer"
                className="text-[#0b57d0] hover:underline flex items-center gap-1 font-semibold"
              >
                console.atlascloud.ai <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* AgentMail Status Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#0b57d0]" />
                <span className="font-bold text-slate-900">AgentMail Service</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ACTIVE INBOX: moms@agentmail.to
              </span>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-slate-200 font-mono text-[11px] space-y-1 text-slate-700">
              <div className="flex justify-between">
                <span>SMTP:</span>
                <span className="text-slate-900 font-semibold">smtp.agentmail.to:465</span>
              </div>
              <div className="flex justify-between">
                <span>IMAP:</span>
                <span className="text-slate-900 font-semibold">imap.agentmail.to:993</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>AI Mail Workspace Secure</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#0b57d0] hover:bg-[#0848b0] text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
