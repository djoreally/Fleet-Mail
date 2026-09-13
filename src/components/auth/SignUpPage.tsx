import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { neon } from '../../lib/neon';
import { captureFleetInvitationFromLocation } from '../../lib/fleetApi';
import { PENDING_AGENTMAIL_ONBOARDING_KEY } from '../onboarding/AgentMailOnboardingGate';
import { AuthError, AuthField, AuthShell, AuthSubmit, getAuthError, type AuthNavigation } from './AuthShell';

interface SignUpPageProps { onNavigate: AuthNavigation; onAuthenticated?: () => void }

export function SignUpPage({ onNavigate, onAuthenticated }: SignUpPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [inboxUsername, setInboxUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invited, setInvited] = useState(false);

  useEffect(() => {
    const invite = captureFleetInvitationFromLocation();
    if (invite) { setInvited(true); if (invite.email) setEmail(invite.email); }
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    if (!invited && !businessName.trim()) return setError('Enter your business name.');
    if (!invited && !/^[a-z0-9][a-z0-9._-]{1,62}$/i.test(inboxUsername.trim())) return setError('Choose a Fleet inbox name with 2–63 letters, numbers, dots, dashes, or underscores.');
    setLoading(true); setError('');
    try {
      const result = await neon.auth.signUp.email({ name: name.trim(), email: email.trim(), password });
      if (result.error) throw result.error;
      if (!invited) localStorage.setItem(PENDING_AGENTMAIL_ONBOARDING_KEY, JSON.stringify({ businessName: businessName.trim(), inboxUsername: inboxUsername.trim().toLowerCase() }));
      onAuthenticated?.();
      onNavigate('/app');
    } catch (reason) { setError(getAuthError(reason, 'We could not create your account. Please try again.')); }
    finally { setLoading(false); }
  }

  return (
    <AuthShell eyebrow={invited ? 'Team invitation' : 'Start your workspace'} title={invited ? 'Join your Fleet OS team' : 'Build a calmer fleet operation'} description={invited ? 'Create your Neon-authenticated identity. Fleet OS will attach you to the invited workspace and role after sign-in.' : 'Create your secure organization. You can invite the rest of your team next.'} onNavigate={onNavigate}>
      <form onSubmit={submit} className="space-y-4">
        {error && <AuthError message={error} />}
        <AuthField label="Full name" name="name" autoComplete="name" required placeholder="Jordan Lee" value={name} onChange={(e) => setName(e.target.value)} />
        {!invited && <AuthField label="Business name" name="businessName" autoComplete="organization" required placeholder="Acme Fleet Services" value={businessName} onChange={(e) => { const value=e.target.value; setBusinessName(value); if (!inboxUsername) setInboxUsername(value.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,63)); }} />}
        {!invited && <div><AuthField label="Fleet inbox name" name="inboxUsername" required placeholder="acmefleet" value={inboxUsername} onChange={(e) => setInboxUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,63))} /><p className="mt-1 text-xs text-slate-500">{inboxUsername || 'yourcompany'}@agentmail.to</p></div>}
        <AuthField label="Work email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <AuthField label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="8 characters minimum" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex items-start gap-2 text-xs leading-5 text-slate-500"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-300" /> Your identity is handled by Neon Auth; workspace roles are enforced separately by Fleet OS.</div>
        <AuthSubmit loading={loading}>{invited ? 'Accept and join' : 'Create workspace'} <ArrowRight className="ml-2 h-4 w-4" /></AuthSubmit>
      </form>
      <p className="mt-7 text-center text-sm text-slate-400">Already have an account? <button onClick={() => onNavigate(`/sign-in${window.location.search || ''}`)} className="font-medium text-cyan-300 hover:text-cyan-200">Sign in</button></p>
    </AuthShell>
  );
}
