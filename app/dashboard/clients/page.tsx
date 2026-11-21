'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { exportToCSV } from '@/lib/export';
import { Users, Edit, Trash2, Save, X, Download } from 'lucide-react';
import { toast, Toaster } from 'sonner';

type ClientCurrencyTotals = Record<string, { billed: number; paid: number }>;

function getClientCurrencyTotals(client: any): ClientCurrencyTotals {
  const totals: ClientCurrencyTotals = {};

  for (const shipment of client.shipments || []) {
    const billingCurrency = String(shipment.currency || 'NGN').toUpperCase();
    totals[billingCurrency] ||= { billed: 0, paid: 0 };
    totals[billingCurrency].billed += Number(shipment.agreed_amount) || 0;

    for (const payment of shipment.payments || []) {
      const paymentCurrency = String(payment.currency || billingCurrency).toUpperCase();
      totals[paymentCurrency] ||= { billed: 0, paid: 0 };
      totals[paymentCurrency].paid += Number(payment.amount) || 0;
    }
  }

  return totals;
}

function formatCurrencyAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

export default function ClientReports() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');

  const fetchClients = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role, is_platform_admin').eq('id', user.id).single();
      if (profile?.role === 'Super Admin' || profile?.is_platform_admin) setUserRole('Super Admin');
      else setUserRole('Other');
    }

    // Fetch clients, shipments, and payments
    const { data, error } = await supabase
      .from('clients')
      .select(`
        id,
        client_name,
        created_at,
        shipments (
          id,
          agreed_amount,
          currency,
          payment_status,
          payments (
            amount,
            currency
          )
        )
      `)
      .order('client_name', { ascending: true });

    if (data) setClients(data);
    if (error) console.error(error);
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleExportCSV = () => {
    if (clients.length === 0) return toast.error("No clients to export.");
    
    const csvData = clients.map(client => {
      const currencyTotals = getClientCurrencyTotals(client);
      const financialBreakdown = Object.entries(currencyTotals)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currency, totals]) => {
          const outstanding = totals.billed - totals.paid;
          return `${currency}: billed ${totals.billed.toFixed(2)}, paid ${totals.paid.toFixed(2)}, balance ${outstanding.toFixed(2)}`;
        })
        .join(' | ');

      return {
        name: client.client_name,
        shipments: client.shipments?.length || 0,
        financial_breakdown: financialBreakdown,
        joined: new Date(client.created_at).toLocaleDateString()
      };
    });

    exportToCSV(csvData, `LogiFlow_Clients_${new Date().toISOString().split('T')[0]}`, [
      { key: 'name', label: 'Client Name' },
      { key: 'shipments', label: 'Total Shipments' },
      { key: 'financial_breakdown', label: 'Currency Breakdown (billed / paid / balance)' },
      { key: 'joined', label: 'Date Joined' }
    ]);
    
    toast.success("CSV Downloaded successfully!");
  };

  const handleEditClick = (client: any) => {
    setEditingId(client.id);
    setEditName(client.client_name);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return toast.error("Client name cannot be empty.");
    const { error } = await supabase.from('clients').update({ client_name: editName }).eq('id', id);
    if (error) toast.error("Failed to update client: " + error.message);
    else { toast.success("Client updated successfully"); setEditingId(null); fetchClients(); }
  };

  const handleDelete = async (client: any) => {
    if (client.shipments && client.shipments.length > 0) {
      return toast.error(`Cannot delete ${client.client_name}. They have ${client.shipments.length} shipment(s) on record.`);
    }
    if (!window.confirm(`Are you sure you want to permanently delete client "${client.client_name}"?`)) return;
    const { error } = await supabase.from('clients').delete().eq('id', client.id);
    if (error) toast.error("Failed to delete client: " + error.message);
    else { toast.success("Client deleted successfully"); fetchClients(); }
  };

  if (loading) return <div className="p-10 text-center text-slate-500 animate-pulse">Loading reports...</div>;

  const isSuperAdmin = userRole === 'Super Admin';

  return (
    <div className="space-y-6">
      <Toaster position="top-right" richColors />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Client Reports</h1>
          <p className="text-slate-500 mt-1 font-medium">Financial overview of all clients.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={handleExportCSV} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-slate-900 transition-colors shadow-md">
            <Download size={18} /> Export CSV
          </button>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm ring-1 ring-indigo-500/10">
            <Users size={24} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Client Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Shipments</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Total Billed</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Total Paid</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Outstanding</th>
                {isSuperAdmin && <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-slate-100">
              {clients.length === 0 && (
                <tr><td colSpan={isSuperAdmin ? 6 : 5} className="px-6 py-8 text-center text-slate-500">No clients found.</td></tr>
              )}
              {clients.map((client) => {
                const currencyTotals = Object.entries(getClientCurrencyTotals(client))
                  .sort(([a], [b]) => a.localeCompare(b));

                return (
                  <tr key={client.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                      {editingId === client.id ? (
                        <div className="flex items-center gap-2">
                          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="border border-slate-300 p-2 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full max-w-xs" autoFocus />
                          <button onClick={() => handleSaveEdit(client.id)} className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-md"><Save size={16} /></button>
                          <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-md"><X size={16} /></button>
                        </div>
                      ) : client.client_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="bg-slate-100 text-slate-700 py-1 px-3 rounded-md text-xs font-bold ring-1 ring-inset ring-slate-200">
                        {client.shipments?.length || 0} Total
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-800">
                      <div className="space-y-1">{currencyTotals.length ? currencyTotals.map(([currency, totals]) => (
                        <div key={currency}>{formatCurrencyAmount(totals.billed, currency)}</div>
                      )) : <span className="text-slate-400">—</span>}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-emerald-600">
                      <div className="space-y-1">{currencyTotals.length ? currencyTotals.map(([currency, totals]) => (
                        <div key={currency}>{formatCurrencyAmount(totals.paid, currency)}</div>
                      )) : <span className="text-slate-400">—</span>}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="space-y-1">{currencyTotals.length ? currencyTotals.map(([currency, totals]) => {
                        const outstanding = totals.billed - totals.paid;
                        return (
                          <div key={currency} className={`inline-flex rounded-md px-2 py-1 font-bold ring-1 ring-inset ${outstanding > 0 ? 'bg-amber-50 text-amber-700 ring-amber-200' : outstanding < 0 ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
                            {formatCurrencyAmount(outstanding, currency)}
                          </div>
                        );
                      }) : <span className="text-slate-400">—</span>}</div>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {editingId !== client.id && (
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditClick(client)} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg"><Edit size={16} /></button>
                            <button onClick={() => handleDelete(client)} className="text-red-600 hover:bg-red-50 p-2 rounded-lg"><Trash2 size={16} /></button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}