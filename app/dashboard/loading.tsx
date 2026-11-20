export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse space-y-6" role="status" aria-label="Loading dashboard">
      <div className="space-y-3"><div className="h-8 w-64 rounded-lg bg-slate-200" /><div className="h-4 w-80 max-w-full rounded bg-slate-100" /></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map(item => <div key={item} className="h-28 rounded-2xl border border-slate-200 bg-white" />)}</div>
      <div className="h-72 rounded-2xl border border-slate-200 bg-white" />
      <span className="sr-only">Loading workspace…</span>
    </div>
  );
}