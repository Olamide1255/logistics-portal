'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, CalendarDays, CheckCircle2, Clock3,
  Loader2, Package, Plane, RefreshCw, ShieldCheck, Truck, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

type CountRow = { label: string; count: number };
type Overview = {
  summary: {
    total_shipments: number;
    created_in_period: number;
    delivered_in_period: number;
    active_shipments: number;
    overdue_delivery_shipments: number;
  };
  status_breakdown: CountRow[];
  daily_volume: { day: string; count: number }[];
  shipment_mix: CountRow[];
  active_age: CountRow[];
};
type QueueItem = {
  id: string;
  awb_number: string;
  shipment_type: string | null;
  current_status: string | null;
  payment_status: string | null;
  created_at: string;
  clients?: { client_name?: string } | null;
};

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function StatCard({ label, value, detail, icon: Icon, tint }: {
  label: string; value: number; detail: string; icon: LucideIcon; tint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 tabular-nums">{value.toLocaleString('en-NG')}</p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <span className={`rounded-xl p-3 ${tint}`}><Icon size={20} /></span>
      </div>
    </div>
  );
}

function ProgressRows({ rows, empty, total }: { rows: CountRow[]; empty: string; total?: number }) {
  const max = Math.max(1, ...(rows || []).map((row) => row.count));
  if (!rows?.length) return <p className="py-8 text-center text-sm text-slate-400">{empty}</p>;
  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const percent = total ? (row.count / total) * 100 : (row.count / max) * 100;
        return (
          <div key={row.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700">{row.label}</span>
              <span className="tabular-nums text-slate-500">{row.count.toLocaleString('en-NG')}{total ? ` · ${percent.toFixed(1)}%` : ''}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${Math.min(100, percent)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [role, setRole] = useState('Loading...');
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [stats, setStats] = useState({ total: 0, pendingFinance: 0, pendingFreight: 0, pendingRFS: 0, pendingOps: 0 });
  const [overview, setOverview] = useState<Overview | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const fetchDashboardData = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setLoadError(false);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace('/login');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, is_platform_admin')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) throw profileError || new Error('Your profile could not be loaded.');

      if (profile.is_platform_admin) {
        setIsPlatformAdmin(true);
        setRole('Platform Admin');
        setOverview(null);
        setQueue([]);
        return;
      }

      const currentRole = profile.role || 'Unknown';
      setRole(currentRole);

      const [totalResult, financeResult, freightResult, rfsResult, opsResult, overviewResult] = await Promise.all([
        supabase.from('shipments_secure').select('id', { count: 'exact', head: true }),
        supabase.from('shipments_secure').select('id', { count: 'exact', head: true }).eq('payment_status', 'Pending'),
        supabase.from('shipments_secure').select('id', { count: 'exact', head: true }).eq('payment_status', 'Approved').eq('current_status', 'Registered'),
        supabase.from('shipments_secure').select('id', { count: 'exact', head: true }).eq('current_status', 'Booked'),
        supabase.from('shipments_secure').select('id', { count: 'exact', head: true }).in('current_status', ['Picked Up', 'Handed to Ops']),
        supabase.rpc('get_operational_overview', {
          p_start_date: new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
          p_end_date: new Date().toISOString().slice(0, 10),
        }),
      ]);

      const countErrors = [totalResult, financeResult, freightResult, rfsResult, opsResult].filter((result) => result.error);
      if (countErrors.length) throw new Error(countErrors.map((result) => result.error?.message).join('; '));
      if (overviewResult.error) throw overviewResult.error;

      setStats({
        total: totalResult.count ?? 0,
        pendingFinance: financeResult.count ?? 0,
        pendingFreight: freightResult.count ?? 0,
        pendingRFS: rfsResult.count ?? 0,
        pendingOps: opsResult.count ?? 0,
      });
      setOverview(overviewResult.data as Overview);

      let queueQuery = supabase
        .from('shipments_secure')
        .select('id, awb_number, shipment_type, current_status, payment_status, created_at, clients(client_name)')
        .order('created_at', { ascending: false })
        .limit(25);

      if (currentRole === 'Finance') {
        queueQuery = queueQuery.eq('payment_status', 'Pending');
      } else if (currentRole === 'Freight') {
        queueQuery = queueQuery.eq('payment_status', 'Approved').eq('current_status', 'Registered');
      } else if (currentRole === 'RFS') {
        queueQuery = queueQuery.eq('current_status', 'Booked');
      } else if (currentRole === 'Operations') {
        queueQuery = queueQuery.in('current_status', ['Picked Up', 'Handed to Ops']);
      } else {
        queueQuery = queueQuery.neq('current_status', 'Delivered');
      }

      const { data: queueData, error: queueError } = await queueQuery;
      if (queueError) throw queueError;
      setQueue((queueData || []) as QueueItem[]);
    } catch (error) {
      console.error('Dashboard data could not be loaded:', error);
      setLoadError(true);
      if (!background) toast.error('Unable to load your dashboard. Please retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchDashboardData();
    const channel = supabase
      .channel('dashboard-shipments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => {
        void fetchDashboardData(true);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchDashboardData]);

  const maxDaily = useMemo(
    () => Math.max(1, ...(overview?.daily_volume || []).map((item) => item.count)),
    [overview?.daily_volume],
  );

  if (loading) {
    return <div className="flex min-h-[55vh] items-center justify-center"><div className="text-center"><Loader2 size={30} className="mx-auto animate-spin text-indigo-600" /><p className="mt-3 text-sm font-medium text-slate-500">Preparing your operational overview…</p></div></div>;
  }

  if (isPlatformAdmin) {
    return (
      <div className="mx-auto flex min-h-[65vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
        <div className="mb-6 rounded-2xl bg-indigo-50 p-5 text-indigo-600"><ShieldCheck size={42} /></div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Platform control centre</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">Manage tenant onboarding, platform health and support operations from the administration workspace.</p>
        <Link href="/platform" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">Open platform dashboard <ArrowRight size={17} /></Link>
      </div>
    );
  }

  return (
    <div className="space-y-7 pb-10">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"><Activity size={14} /> Operations workspace</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Good day, {role}</h1>
          <p className="mt-1 text-sm text-slate-500">Your live shipment overview and work requiring attention.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void fetchDashboardData(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh</button>
          <Link href="/dashboard/shipments" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">Shipment register <ArrowRight size={16} /></Link>
        </div>
      </section>

      {loadError && <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-rose-900">Some dashboard data could not be loaded.</p><p className="mt-1 text-sm text-rose-700">Retry to refresh your shipment metrics and action queue.</p></div><button onClick={() => void fetchDashboardData()} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm ring-1 ring-rose-200">Try again</button></div>}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total shipments" value={overview?.summary.total_shipments ?? stats.total} detail="Across your company workspace" icon={Package} tint="bg-indigo-50 text-indigo-600" />
        <StatCard label="New this period" value={overview?.summary.created_in_period ?? 0} detail="Registered in the last 30 days" icon={CalendarDays} tint="bg-sky-50 text-sky-600" />
        <StatCard label="Active shipments" value={overview?.summary.active_shipments ?? 0} detail="Not currently marked delivered" icon={Truck} tint="bg-amber-50 text-amber-600" />
        <StatCard label="Delivered this period" value={overview?.summary.delivered_in_period ?? 0} detail="Currently marked delivered" icon={CheckCircle2} tint="bg-emerald-50 text-emerald-600" />
        <StatCard label="Past expected date" value={overview?.summary.overdue_delivery_shipments ?? 0} detail="Active shipments past ETA" icon={AlertTriangle} tint="bg-rose-50 text-rose-600" />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting Finance" value={stats.pendingFinance} detail="Payment approval queue" icon={Clock3} tint="bg-amber-50 text-amber-600" />
        <StatCard label="Awaiting Freight" value={stats.pendingFreight} detail="Approved and awaiting booking" icon={Plane} tint="bg-blue-50 text-blue-600" />
        <StatCard label="Awaiting RFS" value={stats.pendingRFS} detail="Booked and awaiting pickup" icon={Truck} tint="bg-violet-50 text-violet-600" />
        <StatCard label="Operations handover" value={stats.pendingOps} detail="Picked up or handed to operations" icon={Activity} tint="bg-teal-50 text-teal-600" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">Shipment activity</h2><p className="mt-1 text-xs text-slate-500">New shipments registered each day over the last 30 days.</p></div><BarChart3 size={20} className="text-slate-400" /></div>
          {!overview?.daily_volume.length ? <p className="py-10 text-center text-sm text-slate-400">No shipment activity in this period.</p> : <div className="flex h-48 items-end gap-1.5 overflow-x-auto pb-1">{overview.daily_volume.map((item) => {
            const height = Math.max(5, (item.count / maxDaily) * 100);
            return <div key={item.day} className="group flex min-w-2 flex-1 flex-col items-center justify-end gap-2" title={`${item.day}: ${item.count} shipments`}><span className="text-[10px] font-semibold text-slate-500 opacity-0 transition group-hover:opacity-100">{item.count}</span><div className="w-full max-w-8 rounded-t-md bg-indigo-500 transition-all group-hover:bg-indigo-600" style={{ height: `${height}%` }} /><span className="text-[9px] text-slate-400">{new Date(`${item.day}T00:00:00`).getDate()}</span></div>;
          })}</div>}
          <p className="mt-3 text-[11px] text-slate-400">Daily counts are based on shipment registration date.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-5"><h2 className="font-bold text-slate-900">Current shipment status</h2><p className="mt-1 text-xs text-slate-500">Status distribution for shipments registered in the last 30 days.</p></div>
          <ProgressRows rows={overview?.status_breakdown || []} total={overview?.summary.created_in_period} empty="No shipments to display." />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5"><h2 className="font-bold text-slate-900">Active shipment age</h2><p className="mt-1 text-xs text-slate-500">Time since registration for shipments not yet delivered.</p></div>
          <ProgressRows rows={overview?.active_age || []} empty="No active shipments." />
          <p className="mt-4 text-[11px] leading-5 text-slate-400">Age is measured from registration, not from the most recent status change. This is not an SLA or delay calculation.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Shipment mix</h2><p className="mt-1 text-xs text-slate-500">Volume by shipment type in the last 30 days.</p></div><Package size={20} className="text-slate-400" /></div>
          <ProgressRows rows={overview?.shipment_mix || []} empty="No shipment types to display." />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-bold text-slate-900">My action queue</h2><p className="mt-1 text-xs text-slate-500">The latest 25 shipments requiring attention for your role.</p></div>
          <div className="flex items-center gap-2"><span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{queue.length} shown</span><Link href="/dashboard/shipments" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">View all</Link></div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/80"><tr>
              <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">AWB / Client</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Type</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Current status</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Registered</th>
              <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {!queue.length && <tr><td colSpan={5} className="px-5 py-14 text-center"><CheckCircle2 size={30} className="mx-auto text-emerald-500" /><p className="mt-3 font-semibold text-slate-700">You're all caught up</p><p className="mt-1 text-sm text-slate-400">No shipments currently require attention in this queue.</p></td></tr>}
              {queue.map((item) => <tr key={item.id} className="transition-colors hover:bg-slate-50/70">
                <td className="px-5 py-4"><Link href={`/dashboard/shipments/${encodeURIComponent(item.awb_number.trim())}`} className="font-semibold text-indigo-600 hover:text-indigo-800">{item.awb_number}</Link><p className="mt-1 max-w-56 truncate text-xs text-slate-500">{item.clients?.client_name || 'Unassigned client'}</p></td>
                <td className="px-5 py-4 text-sm text-slate-600">{item.shipment_type || '—'}</td>
                <td className="px-5 py-4"><span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.current_status || 'Unknown'}</span></td>
                <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td className="px-5 py-4 text-right"><Link href={`/dashboard/shipments/${encodeURIComponent(item.awb_number.trim())}`} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 transition hover:text-indigo-600">Open <ArrowRight size={14} /></Link></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs leading-5 text-slate-400">Live metrics are tenant-scoped by database access policies. Dashboard activity refreshes when shipment records change. Delivery timeliness and overdue receivables will be introduced only after their underlying dates are modelled.</p>
    </div>
  );
}
