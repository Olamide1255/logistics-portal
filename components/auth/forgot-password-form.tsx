'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Loader2, Mail } from 'lucide-react';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (resetError) throw resetError;
      setMessage('If an account exists, a password reset link has been sent to your email.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to send a reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <form onSubmit={handleReset} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200/60">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Mail size={22} /></div>
        <h1 className="mb-2 text-center text-2xl font-bold text-slate-800">Reset password</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Enter your account email and we’ll send a secure reset link.</p>
        {error && <p role="alert" aria-live="polite" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" aria-live="polite" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
        <div className="mb-6">
          <label htmlFor="reset-email" className="mb-2 block text-sm font-bold text-slate-700">Email</label>
          <input id="reset-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} disabled={loading} className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60" />
        </div>
        <button type="submit" disabled={loading} aria-busy={loading} className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 p-3 font-bold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">
          {loading ? <><Loader2 size={17} className="animate-spin" /> Sending…</> : 'Send reset link'}
        </button>
        <div className="text-center"><Link href="/login" className="text-sm text-slate-500 hover:text-slate-800">Back to sign in</Link></div>
      </form>
    </main>
  );
}
