'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { exportToCSV } from '@/lib/export';
import {
  BarChart3, CalendarDays, CheckCircle2, Clock3, Download,
  Loader2, Package, RefreshCw, TrendingUp, Users,
} from 'lucide-react';
import { toast } from 'sonner';

type CountRow = { label: string; count: number };
type CurrencyRow = { currency: string; amount: number };
type ReportData = {
  summary: {
    total_shipments: number;
    delivered_shipments: number;
    active_shipments: number;
    pending_payment_shipments: number;
    overdue_delivery_shipments: number;
    eligible_deliveries: number;
    on_time_deliveries: number;
    late_deliveries: number;
  };
  delivery_performance: {
    eligible_deliveries: number;
    on_time_deliveries: number;
    late_deliveries: number;
    overdue_active_shipments: number;
  };
  receivables_by_currency: { currency: string; amount: number; invoice_count: number }[];
  receivables_without_due_date: { currency: string; amount: number; invoice_count: number }[];
  receivables_ageing: { currency: string; age_bucket: string; amount: number; invoice_count: number }[];
  status_breakdown: CountRow[];
  monthly_volume: { period: string; count: number }[];
  shipment_mix: CountRow[];
  agreed_value_by_currency: CurrencyRow[];
  collections_by_currency: CurrencyRow[];
  top_clients: { client_name: string; shipment_count: number }[];
};

function localDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function currencyAmount(amount: number, currency: string) {
  return `${currency} ${Number(amount || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 tabular-nums">{value.toLocaleString('en-NG')}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
        <span className={`rounded-xl p-3 ${tone}`}><Icon size={20} /></span>
      </div>
    </div>
  );
}

export default function OperationsReportsPage() {
  const today = new Date();
  const endDateDefault = localDate(today);
  const initialStart = new Date(`${endDateDefault}T00:00:00Z`);
  initialStart.setUTCDate(initialStart.getUTCDate() - 29);
  const startDateDefault = initialStart.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(startDateDefault);
  const [endDate, setEndDate] = useState(endDateDefault);
  const [appliedRange, setAppliedRange] = useState({ start: startDateDefault, end: endDateDefault });
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase.rpc('get_operations_report', {
      p_start_date: appliedRange.start,
      p_end_date: appliedRange.end,
    });

    if (error) {
      console.error('Operations report failed:', error);
      setReport(null);
      setLoadError(true);
      toast.error('Unable to load reports. Check your date range and permissions.');
      setLoading(false);
      return;
    }

    setReport(data as ReportData);
    setLoading(false);
  }, [appliedRange]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const totalForStatus = report?.summary.total_shipments || 0;
  const maxMonthly = useMemo(
    () => Math.max(1, ...(report?.monthly_volume || []).map((item) => item.count)),
    [report?.monthly_volume],
  );

  const handleApply = () => {
    if (!startDate || !endDate || endDate < startDate) {
      toast.error('Choose a valid start and end date.');
      return;
    }
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    const days = Math.floor((end.getTime() - start.getTime()) / 86400000);
    if (days > 365) {
      toast.error('Choose a reporting period of no more than 366 days.');
      return;
    }
    setAppliedRange({ start: startDate, end: endDate });
  };

  const handleExport = () => {
    if (!report) return;
    const rows: { section: string; metric: string; value: string }[] = [
      { section: 'Summary', metric: 'Total shipments', value: String(report.summary.total_shipments) },
      { section: 'Summary', metric: 'Delivered shipments', value: String(report.summary.delivered_shipments) },
      { section: 'Summary', metric: 'Active shipments', value: String(report.summary.active_shipments) },
      { section: 'Summary', metric: 'Pending payment shipments', value: String(report.summary.pending_payment_shipments) },
      { section: 'Delivery performance', metric: 'Eligible deliveries', value: String(report.delivery_performance.eligible_deliveries) },
      { section: 'Delivery performance', metric: 'On-time deliveries', value: String(report.delivery_performance.on_time_deliveries) },
      { section: 'Delivery performance', metric: 'Late deliveries', value: String(report.delivery_performance.late_deliveries) },
      { section: 'Delivery performance', metric: 'Active shipments past expected date', value: String(report.delivery_performance.overdue_active_shipments) },
      ...report.receivables_by_currency.map((item) => ({ section: 'Open receivables', metric: item.currency, value: String(item.amount) })),
      ...report.receivables_ageing.map((item) => ({ section: 'Receivables ageing', metric: `${item.currency} ${item.age_bucket}`, value: String(item.amount) })),
      ...report.receivables_without_due_date.map((item) => ({ section: 'Receivables without due date', metric: item.currency, value: String(item.amount) })),
      ...report.agreed_value_by_currency.map((item) => ({ section: 'Agreed shipment value', metric: item.currency, value: String(item.amount) })),
      ...report.collections_by_currency.map((item) => ({ section: 'Recorded collections', metric: item.currency, value: String(item.amount) })),
      ...report.status_breakdown.map((item) => ({ section: 'Status', metric: item.label, value: String(item.count) })),
      ...report.top_clients.map((item) => ({ section: 'Top clients', metric: item.client_name, value: String(item.shipment_count) })),
    ];
    exportToCSV(rows, `operations-report-${appliedRange.start}-to-${appliedRange.end}`, [
      { key: 'section', label: 'Report section' },
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value' },
    ]);
    toast.success('Report export prepared.');
  };

  return (
    <div className="space-y-7 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <BarChart3 size={14} /> Finance & operations intelligence
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Reports centre</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Understand shipment activity, workflow performance, client contribution and cash collections across your selected period.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleExport} disabled={!report || loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
            <Download size={16} /> Export CSV
          </button>
          <button onClick={loadReport} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CalendarDays size={17} className="text-indigo-600" /> Reporting period</h2>
            <p className="mt-1 text-xs text-slate-500">Choose a period of up to 366 days. Dates are applied when you select Update report.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-500">From</span>
              <input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:w-44" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-500">To</span>
              <input type="date" value={endDate} min={startDate || undefined} max={localDate(today)} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:w-44" />
            </label>
            <button onClick={handleApply} disabled={loading} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50">Update report</button>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">Showing {appliedRange.start} to {appliedRange.end}</p>
      </section>

      {loading && (
        <div className="flex min-h-56 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <div className="text-center"><Loader2 className="mx-auto animate-spin text-indigo-600" size={28} /><p className="mt-3 text-sm font-medium text-slate-500">Building your report…</p></div>
        </div>
      )}

      {!loading && loadError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
          <p className="font-semibold text-rose-900">We couldn&apos;t load this report.</p>
          <p className="mt-1 text-sm text-rose-700">Check that you have Finance or Super Admin access and try again.</p>
          <button onClick={loadReport} className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm ring-1 ring-rose-200">Try again</button>
        </div>
      )}

      {!loading && !loadError && report && (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total shipments" value={report.summary.total_shipments} helper="Registered in this period" icon={Package} tone="bg-indigo-50 text-indigo-600" />
            <MetricCard label="Delivered" value={report.summary.delivered_shipments} helper="Currently marked delivered" icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" />
            <MetricCard label="Active shipments" value={report.summary.active_shipments} helper="Not yet marked delivered" icon={TrendingUp} tone="bg-sky-50 text-sky-600" />
            <MetricCard label="Pending payment" value={report.summary.pending_payment_shipments} helper="Shipment payment status" icon={Clock3} tone="bg-amber-50 text-amber-600" />
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5"><h2 className="font-bold text-slate-900">Delivery performance</h2><p className="mt-1 text-xs text-slate-500">Delivered shipments in the selected period with an expected delivery date recorded.</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Eligible deliveries</p><p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{report.delivery_performance.eligible_deliveries.toLocaleString('en-NG')}</p></div>
                <div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">On-time rate</p><p className="mt-2 text-2xl font-bold tabular-nums text-emerald-800">{report.delivery_performance.eligible_deliveries ? `${((report.delivery_performance.on_time_deliveries / report.delivery_performance.eligible_deliveries) * 100).toFixed(1)}%` : '—'}</p></div>
                <div className="rounded-xl bg-emerald-50/70 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">On time</p><p className="mt-2 text-xl font-bold tabular-nums text-slate-900">{report.delivery_performance.on_time_deliveries.toLocaleString('en-NG')}</p></div>
                <div className="rounded-xl bg-rose-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Late</p><p className="mt-2 text-xl font-bold tabular-nums text-rose-800">{report.delivery_performance.late_deliveries.toLocaleString('en-NG')}</p></div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3"><span className="text-sm font-medium text-amber-800">Active shipments past expected date</span><strong className="text-lg tabular-nums text-amber-900">{report.delivery_performance.overdue_active_shipments.toLocaleString('en-NG')}</strong></div>
              <p className="mt-3 text-xs leading-5 text-slate-400">On-time performance excludes shipments without an expected delivery date or a recorded delivery timestamp. Active overdue count is a current snapshot, independent of the selected period.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5"><h2 className="font-bold text-slate-900">Receivables & ageing</h2><p className="mt-1 text-xs text-slate-500">Current unpaid agreed balances, grouped by currency. No exchange-rate conversion is applied.</p></div>
              {report.receivables_by_currency.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No open agreed balances recorded.</p> : <div className="space-y-3">{report.receivables_by_currency.map((item) => <div key={item.currency} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-xs font-semibold uppercase text-slate-500">{item.currency} open balance</p><p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{currencyAmount(item.amount, item.currency)}</p></div><span className="text-xs text-slate-500">{item.invoice_count} shipments</span></div>)}</div>}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Overdue ageing</h3>
                {!report.receivables_ageing.length ? <p className="mt-3 text-sm text-slate-400">No overdue balances with due dates.</p> : <div className="mt-3 space-y-2">{report.receivables_ageing.map((item) => <div key={`${item.currency}-${item.age_bucket}`} className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-600">{item.currency} · {item.age_bucket} <span className="text-xs text-slate-400">({item.invoice_count})</span></span><strong className="tabular-nums text-slate-900">{currencyAmount(item.amount, item.currency)}</strong></div>)}</div>}
              </div>
              {report.receivables_without_due_date.length > 0 && <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/70 p-3"><p className="text-xs font-semibold text-amber-800">Outstanding balances without due dates</p>{report.receivables_without_due_date.map((item) => <p key={item.currency} className="mt-1 text-sm text-amber-900">{currencyAmount(item.amount, item.currency)} · {item.invoice_count} shipments</p>)}</div>}
              <p className="mt-3 text-xs leading-5 text-slate-400">Receivables are a current snapshot. Ageing uses the recorded payment due date and remaining agreed balance after recorded payments.</p>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5"><h2 className="font-bold text-slate-900">Financial overview</h2><p className="mt-1 text-xs text-slate-500">Agreed shipment value and recorded payments are shown separately by currency.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agreed value</p>
                  {report.agreed_value_by_currency.length === 0 ? <p className="mt-3 text-sm text-slate-400">No agreed values recorded.</p> : report.agreed_value_by_currency.map((item) => <div key={item.currency} className="mt-3 flex items-center justify-between gap-3"><span className="text-xs font-medium text-slate-500">{item.currency}</span><strong className="text-sm tabular-nums text-slate-900">{currencyAmount(item.amount, item.currency)}</strong></div>)}
                </div>
                <div className="rounded-xl bg-emerald-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Recorded collections</p>
                  {report.collections_by_currency.length === 0 ? <p className="mt-3 text-sm text-slate-400">No payments recorded in this period.</p> : report.collections_by_currency.map((item) => <div key={item.currency} className="mt-3 flex items-center justify-between gap-3"><span className="text-xs font-medium text-emerald-700">{item.currency}</span><strong className="text-sm tabular-nums text-slate-900">{currencyAmount(item.amount, item.currency)}</strong></div>)}
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-400">Currencies are never combined or converted. Collections are based on payment record dates.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5"><h2 className="font-bold text-slate-900">Shipment status</h2><p className="mt-1 text-xs text-slate-500">Current status of shipments registered in this period.</p></div>
              {report.status_breakdown.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No shipments in this period.</p> : <div className="space-y-4">{report.status_breakdown.map((item) => {
                const percent = totalForStatus ? (item.count / totalForStatus) * 100 : 0;
                return <div key={item.label}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="font-medium text-slate-700">{item.label}</span><span className="tabular-nums text-slate-500">{item.count.toLocaleString('en-NG')} <span className="text-xs">({percent.toFixed(1)}%)</span></span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${percent}%` }} /></div></div>;
              })}</div>}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
              <div className="mb-5"><h2 className="font-bold text-slate-900">Monthly shipment volume</h2><p className="mt-1 text-xs text-slate-500">Shipments created each month within the selected period.</p></div>
              {report.monthly_volume.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No shipment activity in this period.</p> : <div className="space-y-4">{report.monthly_volume.map((item) => {
                const label = new Date(`${item.period}T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
                const percent = (item.count / maxMonthly) * 100;
                return <div key={item.period}><div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-medium text-slate-600">{label}</span><span className="font-semibold tabular-nums text-slate-900">{item.count}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${percent}%` }} /></div></div>;
              })}</div>}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5"><h2 className="font-bold text-slate-900">Shipment mix</h2><p className="mt-1 text-xs text-slate-500">Volume by shipment type.</p></div>
              {report.shipment_mix.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No shipment types to display.</p> : <div className="space-y-3">{report.shipment_mix.map((item) => <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"><span className="text-sm font-medium text-slate-700">{item.label}</span><span className="rounded-lg bg-white px-2.5 py-1 text-sm font-bold tabular-nums text-slate-900 shadow-sm">{item.count}</span></div>)}</div>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">Top clients</h2><p className="mt-1 text-xs text-slate-500">Clients ranked by shipment volume during this period.</p></div><Users size={20} className="text-slate-400" /></div>
            {report.top_clients.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No client activity in this period.</p> : <div className="divide-y divide-slate-100">{report.top_clients.map((item, index) => <div key={item.client_name} className="flex items-center justify-between gap-4 py-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">{index + 1}</span><span className="truncate text-sm font-semibold text-slate-800">{item.client_name}</span></div><span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{item.shipment_count.toLocaleString('en-NG')} <span className="font-normal text-slate-400">shipments</span></span></div>)}</div>}
          </section>

          <p className="text-xs leading-relaxed text-slate-400">Reporting note: delivery timeliness and overdue receivables are not shown because the current shipment model does not yet store expected delivery dates or payment due dates. Adding those fields is required before those KPIs can be calculated honestly.</p>
        </>
      )}
    </div>
  );
}
