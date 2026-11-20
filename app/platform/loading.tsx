import { Loader2 } from 'lucide-react';

export default function PlatformLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse space-y-7" aria-label="Loading SaaS dashboard" role="status">
      <div className="space-y-3"><div className="h-6 w-48 rounded-lg bg-slate-200" /><div className="h-9 w-72 rounded-lg bg-slate-200" /><div className="h-4 w-96 max-w-full rounded bg-slate-100" /></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[1, 2, 3].map(item => <div key={item} className="h-28 rounded-2xl border border-slate-200 bg-white" />)}</div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]"><div className="h-80 rounded-2xl border border-slate-200 bg-white" /><div className="h-80 rounded-2xl border border-slate-200 bg-white" /></div>
      <span className="sr-only"><Loader2 className="animate-spin" /> Loading platform dashboard…</span>
    </div>
  );
}