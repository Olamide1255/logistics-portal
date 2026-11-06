'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, pendingFinance: 0, pendingRFS: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      // In a real app, you'd filter these. For now, let's grab all shipments.
      const { data } = await supabase.from('shipments').select('*');
      if (data) {
        setStats({
          total: data.length,
          pendingFinance: data.filter(s => s.payment_status === 'Pending').length,
          pendingRFS: data.filter(s => s.current_status === 'Registered').length,
        });
      }
    };
    fetchStats();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Total Shipments</h3>
          <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Pending Finance Approval</h3>
          <p className="text-3xl font-bold text-orange-500">{stats.pendingFinance}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Awaiting RFS Pickup</h3>
          <p className="text-3xl font-bold text-blue-500">{stats.pendingRFS}</p>
        </div>
      </div>
    </div>
  );
}