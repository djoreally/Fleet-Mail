import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, RadioTower, ShieldCheck, Wrench } from 'lucide-react';
import { neonAuth } from '../../lib/neon';
import { setActiveNeonAuthSession } from '../../lib/neonAuthClient';
import { captureFleetInvitationFromLocation, fleetFetch, setFleetWorkspaceMode, type FleetWorkspaceMode } from '../../lib/fleetApi';
import { AuthError, AuthField, AuthShell, AuthSubmit, getAuthError, type AuthNavigation } from './AuthShell';

interface SignInPageProps { onNavigate: AuthNavigation; onAuthenticated?: () => void }

const WORKSPACES: Array<{mode:FleetWorkspaceMode;label:string;copy:string;icon:typeof ShieldCheck}> = [
  { mode:'auto', label:'My role', copy:'Owner, admin, or your assigned team workspace', icon:ShieldCheck },
  { mode:'dispatcher', label:'Dispatcher', copy:'Schedule, assignments, capacity, and exceptions', icon:RadioTower },
  { mode:'technician', label:'Technician', copy:'Assigned jobs, inspections, service lines, and completion', icon:Wrench },
];

export function SignInPage({ onNavigate, onAuthenticated }: SignInPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceMode,setWorkspaceMode] = useState<FleetWorkspaceMode>('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invited, setInvited] = useState(false);

  useEffect(() => {
    const invite = captureFleetInvitationFromLocation();
    if (invite) { setInvited(true); if (invite.email) setEmail(invite.email); }
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      setFleetWorkspaceMode(workspaceMode);
      const result = await neonAuth.signIn.email({ email: email.trim(), password });
      if (result.error) throw result.error;

      const token = await neonAuth.getJWTToken();
      if (!token) throw new Error('Sign-in completed but no Fleet session token was issued.');
      setActiveNeonAuthSession(token, null);

      const accessResponse=await fleetFetch('/api/access');
      const access=await accessResponse.json().catch(()=>({}));
      if(!accessResponse.ok) throw new Error(access.error||'That workspace is not available to this account.');
      onAuthenticated?.();
      onNavigate('/app');
    } catch (reason) {
      setActiveNeonAuthSession(null, null);
      setFleetWorkspaceMode('auto');
      setError(getAuthError(reason, 'We could not sign you in. Check your email, password, and workspace access.'));
    }
    finally { setLoading(false); }
  }

  return (
    <AuthShell eyebrow={invited ? 'Team invitation' : 'Welcome back'} title={invited ? 'Sign in to join your team' : 'Sign in to Fleet OS'} description={invited ? 'Use the same work email that received the invitation.' : 'Choose the workspace you need, then sign in with your normal Fleet OS account.'} onNavigate={onNavigate}>
      <form onSubmit={submit} className="space-y-5">
        {error && <AuthError message={error} />}
        {!invited&&<div><p className="mb-2 text-sm font-medium text-slate-200">Workspace</p><div className="grid gap-2 sm:grid-cols-3">{WORKSPACES.map(({mode,label,copy,icon:Icon})=><button key={mode} type="button" onClick={()=>setWorkspaceMode(mode)} aria-pressed={workspaceMode===mode} className={`rounded-xl border p-3 text-left transition ${workspaceMode===mode?'border-cyan-300/70 bg-cyan-300/10 ring-2 ring-cyan-300/10':'border-white/10 bg-white/[0.035] hover:bg-white/[0.06]'}`}><Icon className={`h-4 w-4 ${workspaceMode===mode?'text-cyan-300':'text-slate-400'}`}/><p className="mt-2 text-sm font-semibold text-white">{label}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">{copy}</p></button>)}</div><p className="mt-2 text-[11px] leading-4 text-slate-500">Owners and admins may switch into Dispatcher or Technician mode for controlled testing. Staff accounts remain limited to their assigned role.</p></div>}
        <AuthField label="Work email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div><div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium text-slate-200">Password</span><button type="button" onClick={() => onNavigate('/forgot-password')} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Forgot password?</button></div><input className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/70 focus:ring-4 focus:ring-cyan-400/10" name="password" type="password" autoComplete="current-password" required minLength={8} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <AuthSubmit loading={loading}>{invited ? 'Sign in and join' : workspaceMode==='dispatcher'?'Sign in to Dispatcher OS':workspaceMode==='technician'?'Sign in to Technician OS':'Sign in'} <ArrowRight className="ml-2 h-4 w-4" /></AuthSubmit>
      </form>
      <p className="mt-7 text-center text-sm text-slate-400">New to Fleet OS? <button onClick={() => onNavigate(`/sign-up${window.location.search || ''}`)} className="font-medium text-cyan-300 hover:text-cyan-200">Create an account</button></p>
    </AuthShell>
  );
}
