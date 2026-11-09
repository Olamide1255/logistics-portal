'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function ShipmentsList() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShipments = async () => {
      // Fetch shipments and join with the clients table
      const { data, error } = await supabase
        .from('shipments')
        .select(`*, clients (client_name)`)
        .order('created_at', { ascending: false });
      
      if (data) setShipments(data);
      if (error) console.error("Error fetching shipments:", error);
      setLoading(false);
    };
    fetchShipments();
  }, []);

  if (loading) return <div className="p-10 text-center text-gray-500">Loading shipments...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">All Shipments</h1>
          <p className="text-gray-500">View and manage all registered shipments.</p>
        </div>
        <Link href="/dashboard/register" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium transition">
          + New Shipment
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AWB Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {shipments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No shipments found. Click "New Shipment" to create one.
                </td>
              </tr>
            )}
            {shipments.map((shipment) => (
              <tr key={shipment.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 whitespace-nowrap font-bold text-blue-600">
                  <Link href={`/dashboard/shipments/${shipment.awb_number}`}>{shipment.awb_number}</Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-800">{shipment.clients?.client_name || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-800">{shipment.destination}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${shipment.current_status === 'Registered' ? 'bg-blue-100 text-blue-800' : 
                      shipment.current_status === 'Finance Approved' ? 'bg-purple-100 text-purple-800' :
                      shipment.current_status === 'Handed to Airline' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'}`}>
                    {shipment.current_status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${shipment.payment_status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                    {shipment.payment_status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Link href={`/dashboard/shipments/${shipment.awb_number}`} className="text-blue-600 hover:text-blue-900 hover:underline">
                    View Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}