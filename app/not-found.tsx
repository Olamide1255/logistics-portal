import Link from 'next/link';
import { ArrowLeft, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-9 text-center shadow-xl shadow-slate-900/5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><SearchX size={26} /></div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">404 · Page not found</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">This page isn’t here</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">The link may be outdated, or the page may have moved. Return to your workspace and continue from there.</p>
        <Link href="/dashboard" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/15 transition hover:bg-indigo-700"><ArrowLeft size={16} /> Back to workspace</Link>
      </section>
    </main>
  );
}
