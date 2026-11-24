'use client';
import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Loader2, ShieldCheck, Package, LockKeyhole } from 'lucide-react';
import posthog from 'posthog-js';
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(''); setIsSubmitting(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      if (!data.user) throw new Error('We could not verify your account. Please try again.');
      posthog.identify(data.user.id, {
        ...(data.user.email ? { email: data.user.email } : {}),
      });
      const { data: profile, error: profileError } = await supabase.from('profiles').select('is_platform_admin').eq('id', data.user.id).single();
      if (profileError) throw new Error('Your account is signed in, but its access profile could not be loaded. Please try again.');
      router.replace(profile?.is_platform_admin ? '/platform' : '/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
      setIsSubmitting(false);
    }
  };
  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(79,70,229,0.28),_transparent_45%),radial-gradient(ellipse_at_bottom_right,_rgba(14,165,233,0.16),_transparent_40%)]" />
    <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl shadow-black/30 md:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden flex-col justify-between bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-950 p-12 text-white md:flex">
        <div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20"><Package size={25} /></div>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.22em] text-indigo-200">LogiFlow workspace</p>
          <h1 className="mt-4 max-w-md text-4xl font-bold leading-tight tracking-tight">Clarity and control across every shipment.</h1>
          <p className="mt-5 max-w-sm text-sm leading-6 text-indigo-100/80">A connected workspace for logistics teams, company administrators and platform operations.</p></div>
        <div className="flex items-center gap-3 text-sm text-indigo-100/80"><ShieldCheck size={18} /> Secure access with role-based permissions</div>
      </section>
      <section className="p-7 sm:p-10 md:p-12">
        <div className="mb-9 flex items-center gap-3 md:hidden"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white"><Package size={21} /></div><span className="text-xl font-bold tracking-tight text-slate-900">LogiFlow</span></div>
        <div className="mb-8"><p className="text-sm font-semibold text-indigo-600">Welcome back</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Sign in to your workspace</h2><p className="mt-2 text-sm leading-6 text-slate-500">Use your registered work email and password to continue.</p></div>
        {error && <div role="alert" aria-live="polite" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-5">
          <div><label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">Email address</label><input id="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required disabled={isSubmitting} placeholder="you@company.com" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-60" /></div>
          <div><label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">Password</label><div className="relative"><LockKeyhole size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={isSubmitting} placeholder="Enter your password" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-60" /></div></div>
          <div className="flex justify-end"><Link href="/forgot-password" className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-700 hover:underline">Forgot password?</Link></div>
          <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-wait disabled:bg-indigo-400">{isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Signing you in…</> : <>Sign in <ArrowRight size={18} /></>}</button>
          <p className="pt-2 text-center text-xs text-slate-400">Your access is protected by your organisation’s account permissions.</p>
        </form>
      </section>
    </div>
  </main>;
}