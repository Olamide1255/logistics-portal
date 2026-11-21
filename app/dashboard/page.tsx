'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock,
  Package,
  Plane,
  RefreshCw,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type DashboardStats = {
  total: number;
  pendingFinance: number;
  pendingFreight: number;
  pendingRFS: number;
  pendingOps: number;
};

type QueueItem = {
  id: string;
  awb_number: string;
  shipment_type: string | null;
  current_status: string | null;
  payment_status: string | null;
  created_at: string;
  clients?: { client_name?: string | null } | null;
};

type MetricCardProps = {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  tone: 'indigo' | 'amber' | 'blue' | 'violet' | 'emerald';
};

const EMPTY_STATS: DashboardStats = {
  total: 0,
  pendingFinance: 0,
  pendingFreight: 0,
  pendingRFS: 0,
  pendingOps: 0,
};

const metricTones = {
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
};

function MetricCard({ label, value, detail, icon: Icon, tone }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 tabular-nums">{value.toLocaleString()}</p>
          <p className="mt-1 text-xs font-medium text-slate-400">{detail}</p>
        </div>
        <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${metricTones[tone]}`}>
          <Icon size={21} aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

export default function Dashboard() {
  const [role, setRole] = useState('Loading...');
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const fetchDashboardData = async (backgroundRefresh = false) => {
      if (backgroundRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error('Your session could not be verified. Please sign in again.');

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, is_platform_admin')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        if (profile?.is_platform_admin) {
          if (active) {
            setIsPlatformAdmin(true);
            setRole('Platform Admin');
            setStats(EMPTY_STATS);
            setQueue([]);
          }
          return;
        }

        const currentRole = profile?.role || 'Unknown';
        const visibleShipments = () => supabase.from('shipments_secure');

        // Exact counts are computed by Postgres under the caller's RLS policies.
        // The browser only receives the small action queue, never the whole tenant ledger.
        const totalQuery = visibleShipments().select('id', { count: 'exact', head: true });
        const financeQuery = visibleShipments()
          .select('id', { count: 'exact', head: true })
          .eq('payment_status', 'Pending');
        const freightQuery = visibleShipments()
          .select('id', { count: 'exact', head: true })
          .eq('payment_status', 'Approved')
          .eq('current_status', 'Registered');
        const rfsQuery = visibleShipments()
          .select('id', { count: 'exact', head: true })
          .eq('current_status', 'Booked');
        const opsQuery = visibleShipments()
          .select('id', { count: 'exact', head: true })
          .in('current_status', ['Picked Up', 'Handed to Ops']);

        let queueQuery = visibleShipments().select(
          'id, awb_number, shipment_type, current_status, payment_status, created_at, clients(client_name)',
        );

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

        const [total, finance, freight, rfs, ops, queueResult] = await Promise.all([
          totalQuery,
          financeQuery,
          freightQuery,
          rfsQuery,
          opsQuery,
          queueQuery.order('created_at', { ascending: false }).limit(10),
        ]);

        const queryError = total.error || finance.error || freight.error || rfs.error || ops.error || queueResult.error;
        if (queryError) throw queryError;

        if (active) {
          setIsPlatformAdmin(false);
          setRole(currentRole);
          setStats({
            total: total.count ?? 0,
            pendingFinance: finance.count ?? 0,
            pendingFreight: freight.count ?? 0,
            pendingRFS: rfs.count ?? 0,
            pendingOps: ops.count ?? 0,
          });
          setQueue((queueResult.data || []) as QueueItem[]);
        }
      } catch (fetchError) {
        console.error('Dashboard data could not be loaded:', fetchError);
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : 'Dashboard data could not be loaded. Please try again.');
        }
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void fetchDashboardData();

    const channel = supabase
      .channel('dashboard-shipments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => {
        void fetchDashboardData(true);
      })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (isPlatformAdmin) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center px-4 py-12">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
            <ShieldCheck size={32} aria-hidden="true" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Platform workspace</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Welcome back</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
            Manage tenant onboarding, workspace health, and platform operations from the administration centre.
          </p>
          <Link
            href="/platform"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Open platform dashboard <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      </div>
    );
  }

  const metrics: MetricCardProps[] = [
    { label: 'All shipments', value: stats.total, detail: 'Visible in your workspace', icon: Package, tone: 'indigo' },
    { label: 'Awaiting finance', value: stats.pendingFinance, detail: 'Payment review required', icon: Clock, tone: 'amber' },
    { label: 'Ready for freight', value: stats.pendingFreight, detail: 'Approved and not yet booked', icon: Plane, tone: 'blue' },
    { label: 'RFS queue', value: stats.pendingRFS, detail: 'Awaiting pickup activity', icon: Truck, tone: 'violet' },
    { label: 'Operations queue', value: stats.pendingOps, detail: 'In pickup or operations handover', icon: Activity, tone: 'emerald' },
  ];

  return (
    <main className="space-y-7 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Operations overview</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Good day, {role}</h1>
          <p className="mt-2 text-sm text-slate-500">A live view of the shipments and work queues that need attention.</p>
        </div>
        <button
          type="button"
          onClick={() => { setRefreshing(true); setRefreshKey((current) => current + 1); }}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh view
        </button>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Dashboard data is unavailable</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      )}

      <section aria-label="Shipment metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-950">My action queue</h2>
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{queue.length} shown</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">The latest shipments that match your department's workflow.</p>
          </div>
          <Link href="/dashboard/shipments" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 transition hover:text-indigo-900">
            View all shipments <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        {queue.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircle size={24} aria-hidden="true" />
            </span>
            <h3 className="mt-4 font-semibold text-slate-900">You're all caught up</h3>
            <p className="mt-1 text-sm text-slate-500">New work will appear here when a shipment needs your attention.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50/80">
                <tr>
                  <th scope="col" className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500 sm:px-6">AWB</th>
                  <th scope="col" className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Client</th>
                  <th scope="col" className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Type</th>
                  <th scope="col" className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Status</th>
                  <th scope="col" className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-wide text-slate-500 sm:px-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queue.map((item) => (
                  <tr key={item.id} className="transition hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-5 py-4 font-semibold sm:px-6">
                      <Link href={`/dashboard/shipments/${encodeURIComponent(item.awb_number.trim())}`} className="text-indigo-700 hover:text-indigo-900 hover:underline">
                        {item.awb_number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700">{item.clients?.client_name || '—'}</td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${item.shipment_type === 'Import' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                        {item.shipment_type || '—'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {item.current_status || 'Unknown'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right sm:px-6">
                      <Link href={`/dashboard/shipments/${encodeURIComponent(item.awb_number.trim())}`} className="inline-flex items-center gap-1 font-semibold text-slate-600 transition hover:text-indigo-700">
                        Open <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-xs text-slate-400">Counts are calculated by the database under your tenant access policies. The action queue displays the 10 most recent matching shipments.</p>
    </main>
  );
}
