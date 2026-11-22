'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { exportToCSV } from '@/lib/export';
import {
  Users, Edit, Trash2, Save, X, Download, Search,
  ChevronLeft, ChevronRight, Loader2, FileSpreadsheet,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

type CurrencyTotals = Record<string, { billed: number; paid: number }>;

type ClientReportRow = {
  id: string;
  client_name: string;
  created_at: string;
  shipment_count: number;
  financial_totals: CurrencyTotals;
};

type ClientReportResponse = {
  rows: ClientReportRow[];
  total_count: number;
};

const PAGE_SIZE = 50;
const EXPORT_PAGE_SIZE = 200;

function formatCurrencyAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

function getFinancialBreakdown(totals: CurrencyTotals) {
  return Object.entries(totals || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, values]) => {
      const outstanding = values.billed - values.paid;
      return {
        currency,
        billed: values.billed,
        paid: values.paid,
        outstanding,
      };
    });
}

export default function ClientReports() {
  const [clients, setClients] = useState<ClientReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const requestSequence = useRef(0);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, is_platform_admin')
        .eq('id', user.id)
        .single();

      if (!active) return;
      if (error) {
        toast.error('Unable to verify your account permissions.');
        return;
      }
      setIsSuperAdmin(profile?.role === 'Super Admin' && profile?.is_platform_admin !== true);
    };

    void loadProfile();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(0);
      setSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const fetchClients = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    const { data, error } = await supabase.rpc('get_client_report_page', {
      p_search: search || null,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    });

    if (requestId !== requestSequence.current) return;
    if (error) {
      console.error('Client report query failed:', error);
      toast.error('Unable to load client reports. Please try again.');
      setClients([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    const result = data as ClientReportResponse;
    setClients(Array.isArray(result?.rows) ? result.rows : []);
    setTotalCount(Number(result?.total_count) || 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  const handleExportCSV = async () => {
    if (totalCount === 0) return toast.error('No clients match the current search.');
    setExporting(true);

    try {
      const allClients: ClientReportRow[] = [];
      let offset = 0;

      while (offset < totalCount) {
        const { data, error } = await supabase.rpc('get_client_report_page', {
          p_search: search || null,
          p_limit: EXPORT_PAGE_SIZE,
          p_offset: offset,
        });
        if (error) throw error;

        const result = data as ClientReportResponse;
        const batch = Array.isArray(result?.rows) ? result.rows : [];
        if (batch.length === 0) break;
        allClients.push(...batch);
        offset += batch.length;
      }

      if (allClients.length === 0) return toast.error('No client records were returned for export.');

      const csvData = allClients.map((client) => {
        const financialBreakdown = getFinancialBreakdown(client.financial_totals)
          .map((item) => `${item.currency}: billed ${item.billed.toFixed(2)}, paid ${item.paid.toFixed(2)}, balance ${item.outstanding.toFixed(2)}`)
          .join(' | ');

        return {
          name: client.client_name,
          shipments: client.shipment_count,
          financial_breakdown: financialBreakdown,
          joined: new Date(client.created_at).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos' }),
        };
      });

      exportToCSV(csvData, `LogiFlow_Clients_${new Date().toISOString().split('T')[0]}`, [
        { key: 'name', label: 'Client Name' },
        { key: 'shipments', label: 'Total Shipments' },
        { key: 'financial_breakdown', label: 'Currency Breakdown (billed / paid / balance)' },
        { key: 'joined', label: 'Date Joined' },
      ]);
      toast.success(`Exported ${allClients.length.toLocaleString()} client records.`);
    } catch (error) {
      console.error('Client CSV export failed:', error);
      toast.error('The client export could not be completed. Please retry.');
    } finally {
      setExporting(false);
    }
  };

  const handleEditClick = (client: ClientReportRow) => {
    setEditingId(client.id);
    setEditName(client.client_name);
  };

  const handleSaveEdit = async (id: string) => {
    const nextName = editName.trim();
    if (!nextName) return toast.error('Client name cannot be empty.');
    if (nextName.length > 160) return toast.error('Client name must be 160 characters or fewer.');

    const { error } = await supabase.from('clients').update({ client_name: nextName }).eq('id', id);
    if (error) {
      toast.error('Failed to update client. Please check your permissions and try again.');
    } else {
      toast.success('Client updated successfully.');
      setEditingId(null);
      await fetchClients();
    }
  };

  const handleDelete = async (client: ClientReportRow) => {
    if (client.shipment_count > 0) {
      return toast.error(`Cannot delete ${client.client_name}. It has ${client.shipment_count} shipment(s) on record.`);
    }
    if (!window.confirm(`Are you sure you want to permanently delete client "${client.client_name}"?`)) return;

    const { error } = await supabase.from('clients').delete().eq('id', client.id);
    if (error) {
      toast.error('Failed to delete client. Please try again.');
    } else {
      toast.success('Client deleted successfully.');
      if (clients.length === 1 && page > 0) setPage((current) => current - 1);
      else await fetchClients();
    }
  };

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const firstRow = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastRow = Math.min((page + 1) * PAGE_SIZE, totalCount);

  return (
    <div className="space-y-6">
      <Toaster position="top-right" richColors />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
            <Users size={14} /> Customer intelligence
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Client Reports</h1>
          <p className="mt-1 text-sm text-slate-500">Client activity and financial position, kept separate by currency.</p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={exporting || loading || totalCount === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
          {exporting ? 'Preparing export…' : 'Export all results'}
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search clients by name…"
              aria-label="Search clients by name"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <FileSpreadsheet size={16} />
            <span>{totalCount.toLocaleString()} matching client{totalCount === 1 ? '' : 's'}</span>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-900">Client financial overview</h2>
            <p className="mt-0.5 text-xs text-slate-500">Billed, received and outstanding amounts are never combined across currencies.</p>
          </div>
          {loading && <Loader2 size={18} className="animate-spin text-indigo-600" />}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Client</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Shipments</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Billed</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Paid</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Outstanding</th>
                {isSuperAdmin && <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Actions</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {!loading && clients.length === 0 && (
                <tr>
                  <td colSpan={isSuperAdmin ? 6 : 5} className="px-6 py-14 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Users size={22} /></div>
                    <p className="mt-3 font-semibold text-slate-800">{search ? 'No matching clients' : 'No clients yet'}</p>
                    <p className="mt-1 text-sm text-slate-500">{search ? 'Try another client name.' : 'Client records will appear here as shipments are registered.'}</p>
                  </td>
                </tr>
              )}

              {clients.map((client) => {
                const financialBreakdown = getFinancialBreakdown(client.financial_totals);

                return (
                  <tr key={client.id} className="align-top transition-colors hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      {editingId === client.id ? (
                        <div className="flex min-w-64 items-center gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            aria-label="Client name"
                            maxLength={160}
                            autoFocus
                            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                          />
                          <button onClick={() => handleSaveEdit(client.id)} aria-label="Save client name" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"><Save size={17} /></button>
                          <button onClick={() => setEditingId(null)} aria-label="Cancel editing" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={17} /></button>
                        </div>
                      ) : (
                        <>
                          <p className="font-semibold text-slate-900">{client.client_name}</p>
                          <p className="mt-1 text-xs text-slate-400">Added {new Date(client.created_at).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos' })}</p>
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{client.shipment_count.toLocaleString()}</span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-800">
                      <div className="space-y-1.5">{financialBreakdown.length ? financialBreakdown.map((item) => <div key={item.currency}>{formatCurrencyAmount(item.billed, item.currency)}</div>) : <span className="text-slate-400">—</span>}</div>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-emerald-700">
                      <div className="space-y-1.5">{financialBreakdown.length ? financialBreakdown.map((item) => <div key={item.currency}>{formatCurrencyAmount(item.paid, item.currency)}</div>) : <span className="text-slate-400">—</span>}</div>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <div className="space-y-1.5">
                        {financialBreakdown.length ? financialBreakdown.map((item) => (
                          <div key={item.currency}>
                            <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${item.outstanding > 0 ? 'bg-amber-50 text-amber-700 ring-amber-200' : item.outstanding < 0 ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                              {formatCurrencyAmount(item.outstanding, item.currency)}
                            </span>
                          </div>
                        )) : <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    {isSuperAdmin && (
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {editingId !== client.id && (
                            <>
                              <button onClick={() => handleEditClick(client)} aria-label={`Edit ${client.client_name}`} className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50"><Edit size={16} /></button>
                              <button onClick={() => handleDelete(client)} aria-label={`Delete ${client.client_name}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            {loading ? 'Loading client records…' : totalCount === 0 ? 'No records to display' : `Showing ${firstRow.toLocaleString()}–${lastRow.toLocaleString()} of ${totalCount.toLocaleString()} clients`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={loading || page === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <span className="min-w-20 text-center text-xs font-semibold tabular-nums text-slate-500">Page {Math.min(page + 1, pageCount)} of {pageCount}</span>
            <button
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              disabled={loading || page >= pageCount - 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
