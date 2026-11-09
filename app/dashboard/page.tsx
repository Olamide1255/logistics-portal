'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Package, Clock, CheckCircle, Truck } from 'lucide-react';

export default function Dashboard() {
  const [role, setRole] = useState<string>('Loading...');
  const [stats, setStats] = useState({ total: 0, pendingFinance: 0, pendingRFS: 0, pendingOps: 0 });
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      // 1. Get User Role
      const { data: { user } } = await supabase.auth.getUser();
      let currentRole = 'Unknown';
      if (user?.email) {
        const prefix = user.email.split('@')[0].toLowerCase();
        if (prefix.includes('admin') || prefix.includes('it')) currentRole = 'Super Admin';
        else if (prefix.includes('finance')) currentRole = 'Finance';
        else if (prefix.includes('cs')) currentRole = 'Customer Service';
        else if (prefix.includes('rfs')) currentRole = 'RFS';
        else if (prefix.includes('ops')) currentRole = 'Operations';
      }
      setRole(currentRole);

      // 2. Fetch All Shipments (for stats and queue filtering)
      const { data } = await supabase.from('shipments').select('*, clients(client_name)').order('created_at', { ascending: false });
      
      if (data) {
        // Calculate global stats
        setStats({
          total: data.length,
          pendingFinance: data.filter(s => s.payment_status === 'Pending').length,
          pendingRFS: data.filter(s => s.payment_status === 'Approved' && s.current_status === 'Registered').length,
          pendingOps: data.filter(s => s.current_status === 'Picked Up' || s.current_status === 'Handed to Ops').length,
        });

        // 3. Build Role-Specific Queue
        let filteredQueue = [];
        if (currentRole === 'Finance') {
          // Finance sees anything unpaid
          filteredQueue = data.filter(s => s.payment_status === 'Pending');
        } else if (currentRole === 'RFS') {
          // RFS sees things paid for but not yet picked up
          filteredQueue = data.filter(s => s.payment_status === 'Approved' && s.current_status === 'Registered');
        } else if (currentRole === 'Operations') {
          // Ops sees things picked up by RFS
          filteredQueue = data.filter(s => s.current_status === 'Picked Up' || s.current_status === 'Handed to Ops');
        } else if (currentRole === 'Customer Service') {
          // CS sees everything that isn't delivered yet (to monitor)
          filteredQueue = data.filter(s => s.current_status !== 'Delivered');
        } else {
          // Super Admin sees everything active
          filteredQueue = data.filter(s => s.current_status !== 'Delivered');
        }
        setQueue(filteredQueue);
      }
      setLoading(false);
    };
    fetchDashboardData();
  }, []);

  if (loading) return <div className="p-10 text-center text-gray-500">Loading Dashboard...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Welcome, {role}</h1>
        <p className="text-gray-500">Here is your action center for today.</p>
      </div>
      
      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Shipments</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-1">{stats.total}</h3>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Package size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium">Pending Finance</p>
              <h3 className="text-3xl font-bold text-orange-500 mt-1">{stats.pendingFinance}</h3>
            </div>
            <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Clock size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium">Awaiting RFS</p>
              <h3 className="text-3xl font-bold text-blue-500 mt-1">{stats.pendingRFS}</h3>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Truck size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium">With Operations</p>
              <h3 className="text-3xl font-bold text-purple-500 mt-1">{stats.pendingOps}</h3>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><CheckCircle size={24} /></div>
          </div>
        </div>
      </div>

      {/* ROLE-SPECIFIC QUEUE */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">My Action Queue</h2>
          <p className="text-sm text-gray-500 mt-1">Shipments currently requiring your attention.</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AWB</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {queue.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    🎉 You have no pending actions in your queue!
                  </td>
                </tr>
              )}
              {queue.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-blue-600">
                    <Link href={`/dashboard/shipments/${item.awb_number}`}>{item.awb_number}</Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-800">{item.clients?.client_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      {item.current_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${item.payment_status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                      {item.payment_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link href={`/dashboard/shipments/${item.awb_number}`} className="bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 transition">
                      Process Now
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}