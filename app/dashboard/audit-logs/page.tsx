'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, FileClock, ShieldCheck, Loader2 } from 'lucide-react';

type AuditLog = {
  id: string;
  created_at: string;
  user_email: string | null;
  action: string;
  details: string | null;
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, company_id, is_platform_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    if (profile.role !== 'Super Admin' && !profile.is_platform_admin) {
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    setIsAuthorized(true);
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, created_at, user_email, action, details')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Audit log query failed:', error);
      setLoadError(true);
    } else {
      setLogs((data || []) as AuditLog[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center gap-3 text-sm font-medium text-slate-500" role="status"><Loader2 size={18} className="animate-spin text-indigo-600" />Loading audit history…</div>;
  }

  if (!isAuthorized) {
    return <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-4 text-center"><div className="mb-4 rounded-2xl bg-rose-50 p-4 text-rose-600"><ShieldAlert size={30}/></div><h1 className="text-xl font-bold text-slate-900">Access restricted</h1><p className="mt-2 text-sm text-slate-500">Only company administrators can view this audit history.</p></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-indigo-600"><FileClock size={14}/> Governance</div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Company Audit History</h1>
          <p className="mt-1 text-sm text-slate-500">A chronological record of recent important actions in your company.</p>
        </div>
        <button type="button" onClick={() => void fetchLogs()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"><FileClock size={16}/> Refresh history</button>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-indigo-900">
        <ShieldCheck size={22} className="mt-0.5 shrink-0 text-indigo-600"/>
        <div><p className="text-sm font-bold">Append-only audit history</p><p className="mt-1 text-xs leading-5 text-indigo-800">Audit entries are protected by database permissions and are available here for review. This page shows the latest 100 entries.</p></div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div><h2 className="font-bold text-slate-900">Recent activity</h2><p className="mt-0.5 text-xs text-slate-500">{logs.length.toLocaleString()} {logs.length === 1 ? 'entry' : 'entries'} loaded</p></div>
        </div>
        {loadError ? (
          <div className="px-6 py-12 text-center"><p className="font-semibold text-rose-700">Audit history could not be loaded.</p><p className="mt-1 text-sm text-slate-500">Check your connection and permissions, then try again.</p><button type="button" onClick={() => void fetchLogs()} className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Try again</button></div>
        ) : logs.length === 0 ? (
          <div className="px-6 py-14 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><FileClock size={22}/></div><p className="mt-3 font-semibold text-slate-800">No audit entries yet</p><p className="mt-1 text-sm text-slate-500">Important company activity will appear here as it happens.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50"><tr><th scope="col" className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Date &amp; time (Lagos)</th><th scope="col" className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">User</th><th scope="col" className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Action</th><th scope="col" className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Details</th></tr></thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {logs.map((log) => <tr key={log.id} className="align-top transition-colors hover:bg-slate-50/70"><td className="whitespace-nowrap px-5 py-4 text-xs font-medium text-slate-500">{new Date(log.created_at).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' })}</td><td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">{log.user_email || 'System'}</td><td className="whitespace-nowrap px-5 py-4"><span className="inline-flex rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{log.action}</span></td><td className="min-w-64 px-5 py-4 leading-6 text-slate-700">{log.details || '—'}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
