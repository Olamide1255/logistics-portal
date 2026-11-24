export default function RootLoading() {
  return (
    <main role="status" aria-live="polite" aria-label="Loading LogiFlow" className="min-h-screen bg-slate-50 p-5 sm:p-8">
      <div className="mx-auto max-w-7xl animate-pulse space-y-6">
        <div className="h-12 w-full rounded-2xl bg-white ring-1 ring-slate-200" />
        <div className="space-y-3"><div className="h-8 w-56 rounded-lg bg-slate-200" /><div className="h-4 w-80 max-w-full rounded bg-slate-100" /></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-28 rounded-2xl bg-white ring-1 ring-slate-200" />)}</div>
        <div className="h-72 rounded-2xl bg-white ring-1 ring-slate-200" />
        <span className="sr-only">Loading page content…</span>
      </div>
    </main>
  );
}
