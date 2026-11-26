'use client';

import { useEffect, useState } from 'react';
import { supabase, hasPasswordRecovery, clearPasswordRecovery } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, LockKeyhole } from 'lucide-react';

export default function UpdatePasswordForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const hasRecoveryMarker = () => {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const query = new URLSearchParams(window.location.search);

      return params.get('type') === 'recovery' ||
        query.get('type') === 'recovery';
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;

        if (event === 'PASSWORD_RECOVERY' && session) {
          setRecoveryReady(true);
          setError('');
          setCheckingSession(false);
        }
      }
    );

    const checkRecoverySession = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (!active) return;

        if (sessionError) throw sessionError;

        if (data.session && (hasRecoveryMarker() || hasPasswordRecovery())) {
          setRecoveryReady(true);
        } else if (!data.session) {
          setError('No valid password recovery session was found. Please request a new reset link.');
        } else {
          setError('This is not a password recovery session. Please request a password reset link to continue.');
        }
      } catch {
        if (active) {
          setError('Unable to verify your password recovery session. Please request a new reset link.');
        }
      } finally {
        if (active) setCheckingSession(false);
      }
    };

    void checkRecoverySession();

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (loading || !recoveryReady) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) throw updateError;

      clearPasswordRecovery();

      // End the recovery session so the user must sign in with the new password.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);

      setSuccess('Password updated successfully. Redirecting to sign in...');
      setLoading(false);

      window.setTimeout(() => router.push('/login'), 2000);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update your password. Please try again.'
      );
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <form
        onSubmit={handleUpdate}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200/60"
      >
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <LockKeyhole size={22} />
        </div>

        <h1 className="mb-6 text-center text-2xl font-bold text-slate-800">
          Set a new password
        </h1>

        {checkingSession && (
          <p role="status" className="mb-4 text-center text-sm text-slate-500">
            Verifying password reset link...
          </p>
        )}

        {error && (
          <p role="alert" aria-live="polite" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {success && (
          <p role="status" aria-live="polite" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {success}
          </p>
        )}

        {recoveryReady && !checkingSession && (
          <>
            <div className="mb-6">
              <label htmlFor="new-password" className="mb-2 block text-sm font-bold text-slate-700">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                maxLength={128}
                disabled={loading || !!success}
                className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
              />
              <p className="mt-2 text-xs text-slate-500">
                Use at least 12 characters.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !!success}
              aria-busy={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 p-3 font-bold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Updating...
                </>
              ) : (
                'Update password'
              )}
            </button>
          </>
        )}

        {!checkingSession && !recoveryReady && (
          <Link
            href="/forgot-password"
            className="block text-center text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Request a new password reset link
          </Link>
        )}
      </form>
    </main>
  );
}
