import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { neon } from '../../lib/neon';
import { AuthError, AuthField, AuthShell, AuthSubmit, getAuthError, type AuthNavigation } from './AuthShell';

interface SignInPageProps {
  onNavigate: AuthNavigation;
  onAuthenticated?: () => void;
}

export function SignInPage({ onNavigate, onAuthenticated }: SignInPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await neon.auth.signIn.email({ email: email.trim(), password });
      if (result.error) throw result.error;
      onAuthenticated?.();
      onNavigate('/app');
    } catch (reason) {
      setError(getAuthError(reason, 'We could not sign you in. Check your email and password.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="Welcome back" title="Sign in to your operation" description="Continue to your fleet command center." onNavigate={onNavigate}>
      <form onSubmit={submit} className="space-y-5">
        {error && <AuthError message={error} />}
        <AuthField label="Work email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-200">Password</span>
            <button type="button" onClick={() => onNavigate('/forgot-password')} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Forgot password?</button>
          </div>
          <input className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/70 focus:ring-4 focus:ring-cyan-400/10" name="password" type="password" autoComplete="current-password" required minLength={8} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <AuthSubmit loading={loading}>Sign in <ArrowRight className="ml-2 h-4 w-4" /></AuthSubmit>
      </form>
      <p className="mt-7 text-center text-sm text-slate-400">New to Fleet OS? <button onClick={() => onNavigate('/sign-up')} className="font-medium text-cyan-300 hover:text-cyan-200">Create an account</button></p>
    </AuthShell>
  );
}
