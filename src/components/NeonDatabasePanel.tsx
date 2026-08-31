import React, { useState, useEffect } from 'react';
import {
  Database,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Code2,
  Copy,
  Check,
  Play,
  Key,
  ExternalLink,
  Layers,
  FileCode,
  Terminal,
  Table,
  CheckSquare,
  Download,
  Server,
  ArrowRight
} from 'lucide-react';
import {
  neon,
  checkNeonHealth,
  neonDb,
  DEFAULT_NEON_DATA_API_URL,
  DEFAULT_NEON_AUTH_URL,
  NeonConfigStatus
} from '../lib/neon';
import { SCHEMA_TABLES, RAW_SQL_MIGRATION } from '../db/schema';

export const NeonDatabasePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'explorer' | 'schema' | 'sql'>('schema');
  const [status, setStatus] = useState<NeonConfigStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [queryTable, setQueryTable] = useState<'contacts' | 'emails' | 'chat_messages' | 'inboxes' | 'custom'>('contacts');
  const [customTable, setCustomTable] = useState('contacts');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [selectedSchemaTable, setSelectedSchemaTable] = useState<string>('contacts');

  // Migration states
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationLogs, setMigrationLogs] = useState<string[]>([]);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [tableStatuses, setTableStatuses] = useState<Record<string, any>>({});

  const dataApiUrl =
    (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_NEON_DATA_API_URL) ||
    DEFAULT_NEON_DATA_API_URL;
  const authUrl =
    (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_NEON_AUTH_URL) ||
    DEFAULT_NEON_AUTH_URL;

  const runHealthCheck = async () => {
    setIsChecking(true);
    try {
      const res = await checkNeonHealth();
      setStatus(res);
      // Also fetch schema table statuses
      const schemaRes = await fetch('/api/neon/schema');
      if (schemaRes.ok) {
        const data = await schemaRes.json();
        setTableStatuses(data.tables || {});
      }
    } catch (e: any) {
      setStatus({
        dataApiUrl,
        authUrl,
        isConfigured: true,
        connected: false,
        error: e.message
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  const handleRunMigration = async () => {
    setIsMigrating(true);
    setMigrationLogs([
      `[${new Date().toLocaleTimeString()}] Starting PostgreSQL schema migration...`,
      `[${new Date().toLocaleTimeString()}] Target: Neon Data API / PostgreSQL instance`,
    ]);
    setMigrationResult(null);

    try {
      const res = await fetch('/api/neon/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setMigrationResult(data);
      if (data.logs) {
        setMigrationLogs(data.logs);
      }
      await runHealthCheck();
    } catch (err: any) {
      setMigrationLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ❌ Migration failed: ${err.message || err}`
      ]);
      setMigrationResult({ success: false, error: err.message || err });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleRunQuery = async () => {
    setIsQuerying(true);
    const target = queryTable === 'custom' ? customTable : queryTable;
    try {
      const res = await neonDb.queryTable(target, 10);
      setQueryResult(res);
    } catch (err: any) {
      setQueryResult({ error: err.message || err });
    } finally {
      setIsQuerying(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownloadSQL = () => {
    const blob = new Blob([RAW_SQL_MIGRATION], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'neon-schema-migration.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const snippetCode = `import { createClient } from '@neondatabase/neon-js';

// 1. Initialize client with Data API & Neon Auth
export const neon = createClient({
  auth: { url: import.meta.env.VITE_NEON_AUTH_URL },
  dataApi: { url: import.meta.env.VITE_NEON_DATA_API_URL },
});

// 2. Query your tables (auto-injects user token & enforces RLS)
const { data: contacts, error } = await neon
  .from('contacts')
  .select();`;

  const activeTableDef = SCHEMA_TABLES.find((t) => t.name === selectedSchemaTable) || SCHEMA_TABLES[0];

  return (
    <div id="neon-quickstart-panel" className="p-6 rounded-2xl border border-slate-200 bg-white space-y-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Neon Database & Drizzle ORM Hub</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                <Zap className="w-3 h-3 text-amber-600" />
                Drizzle ORM & Kit
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                @neondatabase/neon-js
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Typed Drizzle schema (Users, Emails, Inboxes, Contacts), safe DDL migrations, and authenticated Data API client.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={runHealthCheck}
            disabled={isChecking}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking...' : 'Check Status'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('schema')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'schema'
              ? 'bg-[#0b57d0] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Table className="w-3.5 h-3.5" />
          <span>Schema & Migration ({SCHEMA_TABLES.length} Tables)</span>
        </button>

        <button
          onClick={() => setActiveTab('sql')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'sql'
              ? 'bg-[#0b57d0] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Raw SQL DDL</span>
        </button>

        <button
          onClick={() => setActiveTab('explorer')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'explorer'
              ? 'bg-[#0b57d0] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Data API Query Explorer</span>
        </button>
      </div>

      {/* TAB 1: SCHEMA & MIGRATION */}
      {activeTab === 'schema' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Action Bar with Migration Button */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-emerald-950">PostgreSQL Schema Ready for Migration</h4>
              </div>
              <p className="text-xs text-emerald-800 mt-1">
                Includes table structures, indexes, and Row-Level Security (RLS) policies for <strong>contacts</strong>, <strong>emails</strong>, <strong>chat_messages</strong>, <strong>inboxes</strong>, and <strong>user_settings</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleRunMigration}
                disabled={isMigrating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs disabled:opacity-60 cursor-pointer active:scale-98"
              >
                <Zap className={`w-3.5 h-3.5 ${isMigrating ? 'animate-spin' : ''}`} />
                <span>{isMigrating ? 'Running Migration...' : 'Run Schema Migration'}</span>
              </button>
            </div>
          </div>

          {/* Migration Execution Logs (if executed) */}
          {migrationLogs.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono space-y-1.5 shadow-inner">
              <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Migration Execution Output</span>
                </span>
                <span className="text-[10px] text-slate-500">
                  {migrationResult?.success ? 'Status: Successful' : isMigrating ? 'Running...' : 'Ready'}
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 pt-1">
                {migrationLogs.map((log, idx) => (
                  <div key={idx} className={log.includes('✓') ? 'text-emerald-400' : log.includes('❌') ? 'text-rose-400' : 'text-slate-300'}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table Schema Viewer */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Select Table to Inspect DDL Schema
            </h4>

            {/* Table Selector Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {SCHEMA_TABLES.map((table) => {
                const isSelected = selectedSchemaTable === table.name;
                return (
                  <button
                    key={table.name}
                    onClick={() => setSelectedSchemaTable(table.name)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#0b57d0] bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-slate-900">{table.name}</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-1">
                      {table.columns.length} columns
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Selected Table Detail Card */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <span className="font-mono text-sm text-[#0b57d0]">{activeTableDef.name}</span>
                    <span className="text-[11px] font-normal text-slate-500">— {activeTableDef.description}</span>
                  </h5>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    RLS: {activeTableDef.rlsPolicy}
                  </span>
                </div>
              </div>

              {/* Columns Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/60 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3.5 font-bold">Column</th>
                      <th className="py-2 px-3.5 font-bold">Type</th>
                      <th className="py-2 px-3.5 font-bold">Key / Nullable</th>
                      <th className="py-2 px-3.5 font-bold">Default</th>
                      <th className="py-2 px-3.5 font-bold">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {activeTableDef.columns.map((col) => (
                      <tr key={col.name} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3.5 font-bold text-slate-900">{col.name}</td>
                        <td className="py-2 px-3.5 text-blue-700">{col.type}</td>
                        <td className="py-2 px-3.5">
                          {col.isPrimary ? (
                            <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                              PRIMARY KEY
                            </span>
                          ) : col.isNullable === false ? (
                            <span className="text-[10px] text-rose-600 font-semibold">NOT NULL</span>
                          ) : (
                            <span className="text-[10px] text-slate-400">NULL</span>
                          )}
                        </td>
                        <td className="py-2 px-3.5 text-slate-500 text-[11px]">
                          {col.defaultValue || '—'}
                        </td>
                        <td className="py-2 px-3.5 text-slate-600 font-sans text-[11px]">
                          {col.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RAW SQL MIGRATION */}
      {activeTab === 'sql' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900">PostgreSQL DDL Migration File</h4>
              <p className="text-[11px] text-slate-500">
                Created at <code className="font-mono bg-slate-100 px-1 rounded">/src/db/schema.sql</code>. Compatible with Neon SQL Console, Neon CLI, and pgAdmin.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadSQL}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .sql</span>
              </button>

              <button
                onClick={() => copyToClipboard(RAW_SQL_MIGRATION, 'raw-sql')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#0b57d0] hover:bg-[#0848b0] transition-colors cursor-pointer shadow-xs"
              >
                {copiedIndex === 'raw-sql' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied to Clipboard</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Full SQL</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-96 border border-slate-800 shadow-inner">
            <pre className="whitespace-pre">{RAW_SQL_MIGRATION}</pre>
          </div>
        </div>
      )}

      {/* TAB 3: DATA API EXPLORER */}
      {activeTab === 'explorer' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#0b57d0]" />
                  VITE_NEON_DATA_API_URL
                </span>
                <button
                  onClick={() => copyToClipboard(dataApiUrl, 'data-url')}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  {copiedIndex === 'data-url' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] font-mono text-slate-600 break-all bg-white p-2 rounded-lg border border-slate-200">
                {dataApiUrl}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  VITE_NEON_AUTH_URL
                </span>
                <button
                  onClick={() => copyToClipboard(authUrl, 'auth-url')}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  {copiedIndex === 'auth-url' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] font-mono text-slate-600 break-all bg-white p-2 rounded-lg border border-slate-200">
                {authUrl}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              {(['contacts', 'emails', 'chat_messages', 'inboxes', 'custom'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setQueryTable(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                    queryTable === tab
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}

              {queryTable === 'custom' && (
                <input
                  type="text"
                  placeholder="Table name..."
                  value={customTable}
                  onChange={(e) => setCustomTable(e.target.value)}
                  className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0b57d0] font-mono"
                />
              )}

              <button
                onClick={handleRunQuery}
                disabled={isQuerying}
                className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#0b57d0] hover:bg-[#0848b0] transition-colors disabled:opacity-60 cursor-pointer shadow-xs"
              >
                <Play className={`w-3 h-3 ${isQuerying ? 'animate-spin' : ''}`} />
                <span>{isQuerying ? 'Querying...' : `Query .from('${queryTable === 'custom' ? customTable : queryTable}')`}</span>
              </button>
            </div>

            {queryResult && (
              <div className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 pb-1.5 mb-1.5 border-b border-slate-800 text-[10px]">
                  <span>Data API Response</span>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(queryResult, null, 2), 'query-res')}
                    className="hover:text-white flex items-center gap-1"
                  >
                    {copiedIndex === 'query-res' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy JSON</span>
                  </button>
                </div>
                <pre className="whitespace-pre-wrap">{JSON.stringify(queryResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

