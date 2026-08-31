import { useState, type FormEvent } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { neon } from '../../lib/neon';
import { AuthError, AuthField, AuthShell, AuthSubmit, getAuthError, type AuthNavigation } from './AuthShell';

interface SignUpPageProps { onNavigate: AuthNavigation; onAuthenticated?: () => void }

export function SignUpPage({ onNavigate, onAuthenticated }: SignUpPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    setLoading(true);
    setError('');
    try {
      const result = await neon.auth.signUp.email({ name: name.trim(), email: email.trim(), password });
      if (result.error) throw result.error;
      onAuthenticated?.();
      onNavigate('/app');
    } catch (reason) {
      setError(getAuthError(reason, 'We could not create your account. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="Start your workspace" title="Build a calmer fleet operation" description="Create your secure organization. You can invite the rest of your team next." onNavigate={onNavigate}>
      <form onSubmit={submit} className="space-y-4">
        {error && <AuthError message={error} />}
        <AuthField label="Full name" name="name" autoComplete="name" required placeholder="Jordan Lee" value={name} onChange={(e) => setName(e.target.value)} />
        <AuthField label="Work email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <AuthField label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="8 characters minimum" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex items-start gap-2 text-xs leading-5 text-slate-500"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-300" /> By continuing, you agree to keep account credentials secure and use Fleet OS for authorized operations.</div>
        <AuthSubmit loading={loading}>Create workspace <ArrowRight className="ml-2 h-4 w-4" /></AuthSubmit>
      </form>
      <p className="mt-7 text-center text-sm text-slate-400">Already have an account? <button onClick={() => onNavigate('/sign-in')} className="font-medium text-cyan-300 hover:text-cyan-200">Sign in</button></p>
    </AuthShell>
  );
}
