import { ArrowLeft, CheckCircle2, Mail, ShieldCheck, Truck } from 'lucide-react';
import type { ReactNode } from 'react';

export type AuthNavigation = (path: string) => void;

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  onNavigate: AuthNavigation;
}

export function AuthShell({ eyebrow, title, description, children, onNavigate }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[#07101f] text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r border-white/10 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_80%_85%,rgba(20,184,166,0.16),transparent_32%)]" />
          <div className="relative">
            <button onClick={() => onNavigate('/')} className="flex items-center gap-3 text-left" aria-label="Return to Fleet OS home">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20">
                <Truck className="h-6 w-6" strokeWidth={2.3} />
              </span>
              <span>
                <span className="block text-lg font-semibold tracking-tight">Fleet OS</span>
                <span className="block text-xs text-slate-400">Operations, in motion.</span>
              </span>
            </button>
          </div>

          <div className="relative max-w-xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-medium text-cyan-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Built for multi-tenant fleets
            </div>
            <h2 className="text-4xl font-semibold leading-[1.08] tracking-[-0.04em] xl:text-5xl">
              Every vehicle, job, driver, and dollar in one operating system.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">
              Replace scattered spreadsheets and inboxes with a live command center your entire team can trust.
            </p>
            <div className="mt-9 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              {['Tenant-isolated data', 'NHTSA VIN intelligence', 'Dispatch-to-invoice workflow', 'Agent-powered communications'].map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-teal-300" /> {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-3 text-xs text-slate-500">
            <Mail className="h-4 w-4" /> Secured by Neon Auth · Communications by AgentMail
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <button
              onClick={() => onNavigate('/')}
              className="mb-10 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white lg:hidden"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Fleet OS
            </button>
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">{eyebrow}</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{title}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

export function AuthField({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>
      <input
        {...props}
        className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/70 focus:bg-white/[0.065] focus:ring-4 focus:ring-cyan-400/10"
      />
    </label>
  );
}

export function AuthSubmit({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex h-12 w-full items-center justify-center rounded-xl bg-cyan-400 px-4 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/15 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60"
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}

export function AuthError({ message }: { message: string }) {
  return <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{message}</div>;
}

export function getAuthError(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
  }
  return fallback;
}
