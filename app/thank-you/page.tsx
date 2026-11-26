import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Mail, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Thank you',
  description: 'Your LogiFlow workspace registration request has been received.',
  robots: { index: false, follow: false },
};

export default function ThankYouPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5 sm:p-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={32} /></div>
        <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Registration received</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">You’re one step away.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-600">We’ve started setting up your workspace. Check the administrator email address you provided and follow the verification link before signing in.</p>
        <div className="mt-7 flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-left">
          <Mail className="mt-0.5 shrink-0 text-indigo-600" size={20} />
          <p className="text-xs leading-5 text-slate-700">If the message does not arrive, check your spam folder. You can request a new verification message from your account administrator or contact support.</p>
        </div>
        <Link href="/login" className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-indigo-700">Go to sign in <ArrowRight size={17} /></Link>
      </section>
    </main>
  );
}
