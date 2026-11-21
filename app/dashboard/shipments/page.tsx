'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  Plus, Search, Plane, Anchor, Loader2, Filter, ChevronDown,
  RotateCcw, Package, CalendarDays,
} from 'lucide-react';

type ShipmentRow = {
  id: string;
  awb_number: string;
  shipment_type: string | null;
  destination: string | null;
  current_status: string | null;
  payment_status: string | null;
  created_at: string;
  clients: { client_name: string } | null;
};

// Keep each register response bounded; the server still reports the exact filtered count.
const PAGE_SIZE = 25;
const STATUS_OPTIONS = [
  'Registered',
  'Booked',
  'Picked Up',
  'Handed to Ops',
  'Export Cleared',
  'Handed to Airline',
  'Delivered',
];

function statusClasses(status: string | null) {
  switch (status) {
    case 'Registered': return 'bg-blue-50 text-blue-700 ring-blue-200';
    case 'Booked': return 'bg-indigo-50 text-indigo-700 ring-indigo-200';
    case 'Picked Up': return 'bg-cyan-50 text-cyan-700 ring-cyan-200';
    case 'Handed to Ops': return 'bg-violet-50 text-violet-700 ring-violet-200';
    case 'Export Cleared': return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'Handed to Airline': return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'Delivered': return 'bg-green-50 text-green-700 ring-green-200';
    default: return 'bg-slate-50 text-slate-700 ring-slate-200';
  }
}

export default function ShipmentsList() {
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    let active = true;

    const getUserRole = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        if (active) setUserRole('Unknown');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, is_platform_admin')
        .eq('id', user.id)
        .single();

      if (!active) return;
      if (error || !profile) {
        setUserRole('Unknown');
        return;
      }
      setUserRole(profile.is_platform_admin ? 'Platform Admin' : profile.role || 'Unknown');
    };

    void getUserRole();
    return () => { active = false; };
  }, []);

  const fetchShipments = useCallback(async (
    currentPage: number,
    search: string,
    status: string,
    payment: string,
    shipmentType: string,
  ) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setLoadError(false);

    let query = supabase
      .from('shipments_secure')
      .select('id, awb_number, shipment_type, destination, current_status, payment_status, created_at, clients!inner(client_name)', { count: 'exact' })
      .order('created_at', { ascending: false });

    const safeSearch = search.replace(/[(),%]/g, '').trim();
    if (safeSearch) {
      query = query.or(`awb_number.ilike.%${safeSearch}%,clients.client_name.ilike.%${safeSearch}%`);
    }
    if (status) query = query.eq('current_status', status);
    if (payment) query = query.eq('payment_status', payment);
    if (shipmentType) query = query.eq('shipment_type', shipmentType);

    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await query.range(from, to);

    if (requestId !== requestSequence.current) return;

    if (error) {
      console.error('Shipment register query failed:', error);
      setLoadError(true);
      setHasMore(false);
      setTotalCount(0);
      if (currentPage === 0) setShipments([]);
      setLoading(false);
      return;
    }

    const rows = (data || []) as unknown as ShipmentRow[];
    setShipments((currentPage === 0) ? rows : (previous) => [...previous, ...rows]);
    setTotalCount(count ?? 0);
    setHasMore((currentPage + 1) * PAGE_SIZE < (count ?? 0));
    setLoading(false);
  }, []);

  useEffect(() => {
    const debounce = window.setTimeout(() => {
      setPage(0);
      void fetchShipments(0, searchTerm, statusFilter, paymentFilter, typeFilter);
    }, 350);

    return () => window.clearTimeout(debounce);
  }, [searchTerm, statusFilter, paymentFilter, typeFilter, fetchShipments]);

  const loadMore = () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    void fetchShipments(nextPage, searchTerm, statusFilter, paymentFilter, typeFilter);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setPaymentFilter('');
    setTypeFilter('');
    setPage(0);
  };

  const hasActiveFilters = Boolean(searchTerm || statusFilter || paymentFilter || typeFilter);
  const canCreateShipment = userRole === 'Super Admin' || userRole === 'Customer Service' || userRole === 'Freight';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
            <Package size={14} /> Operations workspace
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Shipment Register</h1>
          <p className="mt-1 text-sm text-slate-500">Find shipments, monitor milestones and focus on work that needs attention.</p>
        </div>
        {canCreateShipment && (
          <Link href="/dashboard/register" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 sm:w-auto">
            <Plus size={18} /> New Shipment
          </Link>
        )}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search AWB or client name…"
              aria-label="Search shipments by AWB or client name"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:w-[610px]">
            <label className="relative">
              <span className="sr-only">Filter by shipment status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10">
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </label>
            <label className="relative">
              <span className="sr-only">Filter by payment status</span>
              <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10">
                <option value="">All payment states</option>
                <option value="Pending">Payment pending</option>
                <option value="Approved">Payment approved</option>
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </label>
            <label className="relative">
              <span className="sr-only">Filter by shipment type</span>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10">
                <option value="">All shipment types</option>
                <option value="Export">Export</option>
                <option value="Import">Import</option>
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Filter size={14} />
            <span>{totalCount.toLocaleString()} matching shipment{totalCount === 1 ? '' : 's'}</span>
            {hasActiveFilters && <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">Filters active</span>}
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
              <RotateCcw size={13} /> Clear filters
            </button>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-900">All shipments</h2>
            <p className="mt-0.5 text-xs text-slate-500">Newest registrations appear first.</p>
          </div>
          {loading && <Loader2 size={18} className="animate-spin text-indigo-600" />}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">AWB number</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Client</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Type</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Destination</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Payment</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Current status</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Registered</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && loadError && (
                <tr><td colSpan={8} className="px-6 py-12 text-center">
                  <p className="font-semibold text-slate-800">We couldn't load the shipment register.</p>
                  <p className="mt-1 text-sm text-slate-500">Check your connection and try again.</p>
                  <button onClick={() => void fetchShipments(0, searchTerm, statusFilter, paymentFilter, typeFilter)} className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700">Retry</button>
                </td></tr>
              )}
              {!loading && !loadError && shipments.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-14 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Package size={22} /></div>
                  <p className="mt-3 font-semibold text-slate-800">{hasActiveFilters ? 'No matching shipments' : 'No shipments yet'}</p>
                  <p className="mt-1 text-sm text-slate-500">{hasActiveFilters ? 'Try changing or clearing your filters.' : 'New shipment registrations will appear here.'}</p>
                </td></tr>
              )}
              {shipments.map((shipment) => (
                <tr key={shipment.id} className="align-middle transition-colors hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-5 py-4">
                    <Link href={`/dashboard/shipments/${encodeURIComponent(shipment.awb_number.trim())}`} className="font-bold text-indigo-600 hover:text-indigo-800">{shipment.awb_number}</Link>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-800">{shipment.clients?.client_name || 'N/A'}</td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${shipment.shipment_type === 'Import' ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-orange-50 text-orange-700 ring-orange-200'}`}>
                      {shipment.shipment_type === 'Import' ? <Anchor size={12} /> : <Plane size={12} />}
                      {shipment.shipment_type || 'Export'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{shipment.destination || '—'}</td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${shipment.payment_status === 'Approved' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}>
                      {shipment.payment_status || 'Pending'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClasses(shipment.current_status)}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {shipment.current_status || 'Unknown'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} />{new Date(shipment.created_at).toLocaleDateString()}</span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right">
                    <Link href={`/dashboard/shipments/${encodeURIComponent(shipment.awb_number.trim())}`} className="text-sm font-semibold text-slate-500 transition hover:text-indigo-600">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            {loading ? 'Loading shipments…' : shipments.length === 0 ? 'No records to display' : `Showing ${shipments.length.toLocaleString()} of ${totalCount.toLocaleString()} matching shipments`}
          </p>
          {hasMore && (
            <button onClick={loadMore} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-50">
              {loading ? <><Loader2 className="animate-spin" size={16} /> Loading…</> : 'Load more shipments'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
