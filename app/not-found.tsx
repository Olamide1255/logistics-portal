import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Home, SearchX } from 'lucide-react';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false, follow: false } };\n\nexport default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-9 text-center shadow-xl shadow-slate-900/5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><SearchX size={26} /></div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Error 404</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">We can’t find that page.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">The address may be incorrect, the page may have moved, or you may not have a valid link. Choose a safe place to continue.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/15 transition hover:bg-indigo-700"><Home size={16} /> Back to home</Link>
          <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><ArrowLeft size={16} /> Sign in</Link>
        </div>
      </section>
    </main>
  );
}
