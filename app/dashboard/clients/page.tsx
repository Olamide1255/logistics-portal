'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { exportToCSV } from '@/lib/export';
import { Users, Edit, Trash2, Save, X, Download } from 'lucide-react';
import { toast, Toaster } from 'sonner';

export default function ClientReports() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');

  const fetchClients = async () => {
    // Get User Role securely from Database
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // FIXED: Added is_platform_admin to the select query
      const { data: profile } = await supabase.from('profiles').select('role, is_platform_admin').eq('id', user.id).single();
      if (profile?.role === 'Super Admin' || profile?.is_platform_admin) setUserRole('Super Admin');
      else setUserRole('Other');
    }

    // Fetch clients and their related shipments
    const { data, error } = await supabase
      .from('clients')
      .select(`
        id,
        client_name,
        created_at,
        shipments (
          id,
          payment_status
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
    
    const csvData = clients.map(c => ({
      name: c.client_name,
      total: c.shipments?.length || 0,
      approved: c.shipments?.filter((s: any) => s.payment_status === 'Approved').length || 0,
      pending: c.shipments?.filter((s: any) => s.payment_status === 'Pending').length || 0,
      joined: new Date(c.created_at).toLocaleDateString()
    }));

    exportToCSV(csvData, `LogiFlow_Clients_${new Date().toISOString().split('T')[0]}`, [
      { key: 'name', label: 'Client Name' },
      { key: 'total', label: 'Total Shipments' },
      { key: 'approved', label: 'Approved (Paid)' },
      { key: 'pending', label: 'Pending Payment' },
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

    const { error } = await supabase
      .from('clients')
      .update({ client_name: editName })
      .eq('id', id);

    if (error) {
      toast.error("Failed to update client: " + error.message);
    } else {
      toast.success("Client updated successfully");
      setEditingId(null);
      fetchClients();
    }
  };

  const handleDelete = async (client: any) => {
    if (client.shipments && client.shipments.length > 0) {
      toast.error(`Cannot delete ${client.client_name}. They have ${client.shipments.length} shipment(s) on record. Delete the shipments first.`);
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to permanently delete client "${client.client_name}"?`);
    if (!confirmDelete) return;

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', client.id);

    if (error) {
      toast.error("Failed to delete client: " + error.message);
    } else {
      toast.success("Client deleted successfully");
      fetchClients();
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500 animate-pulse">Loading reports...</div>;

  const isSuperAdmin = userRole === 'Super Admin';

  return (
    <div className="space-y-6">
      <Toaster position="top-right" richColors />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Client Reports</h1>
          <p className="text-slate-500 mt-1 font-medium">Overview of all clients and their shipment history.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-slate-900 transition-colors shadow-md"
          >
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
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Total Shipments</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Approved (Paid)</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Payment</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Joined Date</th>
                {isSuperAdmin && (
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-slate-100">
              {clients.length === 0 && (
                <tr>
                  <td colSpan={isSuperAdmin ? 6 : 5} className="px-6 py-8 text-center text-slate-500">No clients found.</td>
                </tr>
              )}
              {clients.map((client) => {
                const totalShipments = client.shipments?.length || 0;
                const approved = client.shipments?.filter((s: any) => s.payment_status === 'Approved').length || 0;
                const pending = client.shipments?.filter((s: any) => s.payment_status === 'Pending').length || 0;

                return (
                  <tr key={client.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                      {editingId === client.id ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={editName} 
                            onChange={(e) => setEditName(e.target.value)}
                            className="border border-slate-300 p-2 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full max-w-xs"
                            autoFocus
                          />
                          <button onClick={() => handleSaveEdit(client.id)} className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-md transition-colors"><Save size={16} /></button>
                          <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-md transition-colors"><X size={16} /></button>
                        </div>
                      ) : (
                        client.client_name
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="bg-slate-100 text-slate-700 py-1 px-3 rounded-md text-xs font-bold ring-1 ring-inset ring-slate-200">
                        {totalShipments} Total
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="bg-emerald-50 text-emerald-700 py-1 px-3 rounded-md text-xs font-bold ring-1 ring-inset ring-emerald-200">
                        {approved}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`py-1 px-3 rounded-md text-xs font-bold ring-1 ring-inset ${pending > 0 ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
                        {pending}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                      {new Date(client.created_at).toLocaleDateString()}
                    </td>
                    
                    {isSuperAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {editingId !== client.id && (
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditClick(client)} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors" title="Edit Client">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDelete(client)} className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Delete Client">
                              <Trash2 size={16} />
                            </button>
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