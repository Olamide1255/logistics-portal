'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Users, FileText } from 'lucide-react';

export default function ClientReports() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
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
    fetchClients();
  }, []);

  if (loading) return <div className="p-10 text-center text-gray-500">Loading reports...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Client Reports</h1>
          <p className="text-gray-500">Overview of all clients and their shipment history.</p>
        </div>
        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
          <Users size={28} />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Shipments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approved (Paid)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Payment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No clients found.</td>
                </tr>
              )}
              {clients.map((client) => {
                const totalShipments = client.shipments?.length || 0;
                const approved = client.shipments?.filter((s: any) => s.payment_status === 'Approved').length || 0;
                const pending = client.shipments?.filter((s: any) => s.payment_status === 'Pending').length || 0;

                return (
                  <tr key={client.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
                      {client.client_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="bg-gray-100 text-gray-800 py-1 px-3 rounded-full text-xs font-bold">
                        {totalShipments} Total
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="bg-green-100 text-green-800 py-1 px-3 rounded-full text-xs font-bold">
                        {approved}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`py-1 px-3 rounded-full text-xs font-bold ${pending > 0 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-500'}`}>
                        {pending}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(client.created_at).toLocaleDateString()}
                    </td>
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