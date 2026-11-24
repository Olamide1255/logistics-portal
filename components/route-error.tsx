'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

type RouteErrorProps = {
  title: string;
  description: string;
  reset: () => void;
  error?: Error & { digest?: string };
};

export function RouteError({ title, description, reset, error }: RouteErrorProps) {
  useEffect(() => {
    if (!error) return;
    const path = window.location.pathname.startsWith('/track/') ? '/track/[token]' : window.location.pathname.startsWith('/dashboard/shipments/') ? '/dashboard/shipments/[awb]' : window.location.pathname;
    void fetch('/api/monitoring/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message || 'React route error', stack: error.stack || '', path }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <section role="alert" className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5 sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
          <AlertTriangle size={26} />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Something needs attention</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">{description}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/15 transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20">
            <RefreshCw size={16} /> Try again
          </button>
          <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200">
            <ArrowLeft size={16} /> Return to workspace
          </Link>
        </div>
      </section>
    </main>
  );
}
