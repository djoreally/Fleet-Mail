import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, LockKeyhole } from 'lucide-react';
import { neon } from '../../lib/neon';
import { AuthError, AuthField, AuthShell, AuthSubmit, getAuthError, type AuthNavigation } from './AuthShell';

export function ResetPasswordPage({ onNavigate }: { onNavigate: AuthNavigation }) {
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token') || '', []);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return setError('This reset link is missing its security token. Request a new link.');
    if (password.length < 8) return setError('Use at least 8 characters for your new password.');
    if (password !== confirmation) return setError('The passwords do not match.');
    setLoading(true);
    setError('');
    try {
      const result = await neon.auth.resetPassword({ newPassword: password, token });
      if (result.error) throw result.error;
      setComplete(true);
    } catch (reason) {
      setError(getAuthError(reason, 'This reset link may be invalid or expired. Request a new one.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Secure reset"
      title={complete ? 'Password updated' : 'Choose a new password'}
      description={complete ? 'Your account is secure and ready for you.' : 'Create a strong password you have not used for this account before.'}
      onNavigate={onNavigate}
    >
      {complete ? (
        <div className="space-y-6">
          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-teal-300/20 bg-teal-300/10"><CheckCircle2 className="h-7 w-7 text-teal-300" /></div>
          <button onClick={() => onNavigate('/sign-in')} className="flex h-12 w-full items-center justify-center rounded-xl bg-cyan-400 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Continue to sign in</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          {error && <AuthError message={error} />}
          {!token && <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">Open the secure link from your reset email, or request a new one below.</div>}
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300"><LockKeyhole className="h-5 w-5" /></div>
          <AuthField label="New password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="8 characters minimum" value={password} onChange={(event) => setPassword(event.target.value)} />
          <AuthField label="Confirm new password" name="confirmation" type="password" autoComplete="new-password" required minLength={8} placeholder="Enter it again" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          <AuthSubmit loading={loading}>Update password</AuthSubmit>
          {!token && <button type="button" onClick={() => onNavigate('/forgot-password')} className="w-full text-sm text-cyan-300 hover:text-cyan-200">Request a new reset link</button>}
        </form>
      )}
    </AuthShell>
  );
}
