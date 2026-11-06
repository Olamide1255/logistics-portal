'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function ShipmentsList() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShipments = async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select(`*, clients (client_name)`)
        .order('created_at', { ascending: false });
      
      if (data) setShipments(data);
      setLoading(false);
    };
    fetchShipments();
  }, []);

  if (loading) return <p>Loading shipments...</p>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">All Shipments</h1>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AWB Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {shipments.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No shipments found.</td></tr>
            )}
            {shipments.map((shipment) => (
              <tr key={shipment.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">
                  <Link href={`/dashboard/shipments/${shipment.awb_number}`}>{shipment.awb_number}</Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{shipment.clients?.client_name || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap">{shipment.destination}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${shipment.current_status === 'Registered' ? 'bg-blue-100 text-blue-800' : 
                      shipment.current_status === 'Pending' ? 'bg-orange-100 text-orange-800' : 
                      'bg-green-100 text-green-800'}`}>
                    {shipment.current_status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <Link href={`/dashboard/shipments/${shipment.awb_number}`} className="text-blue-600 hover:underline">View Details</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}