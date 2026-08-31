import { useState, type FormEvent } from 'react';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { neon } from '../../lib/neon';
import { AuthError, AuthField, AuthShell, AuthSubmit, getAuthError, type AuthNavigation } from './AuthShell';

export function ForgotPasswordPage({ onNavigate }: { onNavigate: AuthNavigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await neon.auth.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (result.error) throw result.error;
      setSent(true);
    } catch (reason) {
      setError(getAuthError(reason, 'We could not send the reset email. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="Account recovery" title={sent ? 'Check your inbox' : 'Reset your password'} description={sent ? `If an account exists for ${email}, a secure reset link is on its way.` : 'Enter your work email and we’ll send you a secure reset link.'} onNavigate={onNavigate}>
      {sent ? (
        <div className="space-y-6">
          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-teal-300/20 bg-teal-300/10"><MailCheck className="h-7 w-7 text-teal-300" /></div>
          <button onClick={() => onNavigate('/sign-in')} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 text-sm font-semibold text-slate-950 hover:bg-cyan-300"><ArrowLeft className="h-4 w-4" /> Return to sign in</button>
          <button onClick={() => setSent(false)} className="w-full text-sm text-slate-400 hover:text-white">Try another email</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          {error && <AuthError message={error} />}
          <AuthField label="Work email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <AuthSubmit loading={loading}>Send reset link</AuthSubmit>
          <button type="button" onClick={() => onNavigate('/sign-in')} className="flex w-full items-center justify-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to sign in</button>
        </form>
      )}
    </AuthShell>
  );
}
