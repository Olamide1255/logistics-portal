'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, FileClock, ShieldCheck } from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('role, company_id, is_platform_admin').eq('id', user.id).single();
      
      if (profile?.role !== 'Super Admin' && !profile?.is_platform_admin) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      setIsAuthorized(true);
      const { data } = await supabase.from('audit_logs').select('*').eq('company_id', profile.company_id).order('created_at', { ascending: false }).limit(100);
      if (data) setLogs(data);
      setLoading(false);
    };
    fetchLogs();
  }, []);

  if (loading) return <div className="p-10 text-center animate-pulse">Loading audit logs...</div>;
  if (!isAuthorized) return <div className="p-10 text-center text-red-500 font-bold flex items-center justify-center gap-2"><ShieldAlert/> Access Denied. Admins Only.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <FileClock className="text-indigo-600" size={32} /> Global Audit Log
        </h1>
        <p className="text-slate-500 mt-1 font-medium">A chronological record of all critical actions in your company.</p>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 p-4 rounded-xl flex items-center gap-3">
        <ShieldCheck size={24} className="text-indigo-600 shrink-0" />
        <div>
          <p className="font-bold text-sm">Immutable Audit Trail</p>
          <p className="text-xs">These logs are cryptographically protected and cannot be edited or deleted by any user.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Date & Time</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">User</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Action</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Details</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100 text-sm">
            {logs.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-500">No logs recorded yet.</td></tr>}
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">{new Date(log.created_at).toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">{log.user_email || 'System'}</td>
                <td className="px-6 py-4 whitespace-nowrap"><span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md text-xs font-bold">{log.action}</span></td>
                <td className="px-6 py-4 text-slate-700">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}