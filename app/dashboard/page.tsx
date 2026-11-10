'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Package, Clock, CheckCircle, Truck, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const [role, setRole] = useState<string>('Loading...');
  const [stats, setStats] = useState({ total: 0, pendingFinance: 0, pendingRFS: 0, pendingOps: 0 });
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let currentRole = 'Unknown';
      if (user?.email) {
        const prefix = user.email.split('@')[0].toLowerCase();
        if (prefix.includes('admin') || prefix.includes('it')) currentRole = 'Super Admin';
        else if (prefix.includes('finance')) currentRole = 'Finance';
        else if (prefix.includes('cs') || prefix.includes('info')) currentRole = 'Customer Service';
        else if (prefix.includes('rfs')) currentRole = 'RFS';
        else if (prefix.includes('ops')) currentRole = 'Operations';
      }
      setRole(currentRole);

      const { data } = await supabase.from('shipments').select('*, clients(client_name)').order('created_at', { ascending: false });
      
      if (data) {
        setStats({
          total: data.length,
          pendingFinance: data.filter(s => s.payment_status === 'Pending').length,
          pendingRFS: data.filter(s => s.payment_status === 'Approved' && s.current_status === 'Registered').length,
          pendingOps: data.filter(s => s.current_status === 'Picked Up' || s.current_status === 'Handed to Ops').length,
        });

        let filteredQueue = [];
        if (currentRole === 'Finance') filteredQueue = data.filter(s => s.payment_status === 'Pending');
        else if (currentRole === 'RFS') filteredQueue = data.filter(s => s.payment_status === 'Approved' && s.current_status === 'Registered');
        else if (currentRole === 'Operations') filteredQueue = data.filter(s => s.current_status === 'Picked Up' || s.current_status === 'Handed to Ops');
        else if (currentRole === 'Customer Service') filteredQueue = data.filter(s => s.current_status !== 'Delivered');
        else filteredQueue = data.filter(s => s.current_status !== 'Delivered');
        
        setQueue(filteredQueue);
      }
      setLoading(false);
    };
    fetchDashboardData();
  }, []);

  if (loading) return <div className="p-10 text-center text-slate-500 animate-pulse">Loading Dashboard...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome back, {role}</h1>
        <p className="text-slate-500 mt-1 font-medium">Here is the operational overview for today.</p>
      </div>
      
      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60 hover:shadow-md hover:ring-slate-300/60 transition-all duration-300 group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-sm font-semibold tracking-wide uppercase">Total Shipments</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-2 group-hover:text-indigo-600 transition-colors">{stats.total}</h3>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 group-hover:scale-110 transition-transform duration-300"><Package size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60 hover:shadow-md hover:ring-slate-300/60 transition-all duration-300 group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-sm font-semibold tracking-wide uppercase">Pending Finance</p>
              <h3 className="text-3xl font-bold text-amber-500 mt-2 group-hover:text-amber-600 transition-colors">{stats.pendingFinance}</h3>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl text-amber-500 group-hover:scale-110 transition-transform duration-300"><Clock size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60 hover:shadow-md hover:ring-slate-300/60 transition-all duration-300 group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-sm font-semibold tracking-wide uppercase">Awaiting RFS</p>
              <h3 className="text-3xl font-bold text-blue-500 mt-2 group-hover:text-blue-600 transition-colors">{stats.pendingRFS}</h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl text-blue-500 group-hover:scale-110 transition-transform duration-300"><Truck size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60 hover:shadow-md hover:ring-slate-300/60 transition-all duration-300 group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-sm font-semibold tracking-wide uppercase">With Operations</p>
              <h3 className="text-3xl font-bold text-purple-500 mt-2 group-hover:text-purple-600 transition-colors">{stats.pendingOps}</h3>
            </div>
            <div className="p-3 bg-purple-50 rounded-xl text-purple-500 group-hover:scale-110 transition-transform duration-300"><CheckCircle size={24} /></div>
          </div>
        </div>
      </div>

      {/* ROLE-SPECIFIC QUEUE */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div>
            <h2 className="text-lg font-bold text-slate-900">My Action Queue</h2>
            <p className="text-sm text-slate-500 mt-1">Shipments currently requiring your attention.</p>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">AWB</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Payment</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {queue.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                        <CheckCircle className="text-slate-400" size={24} />
                      </div>
                      <p className="text-base font-medium text-slate-900">You're all caught up!</p>
                      <p className="text-sm mt-1">No pending actions in your queue.</p>
                    </div>
                  </td>
                </tr>
              )}
              {queue.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/dashboard/shipments/${item.awb_number}`} className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                      {item.awb_number}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">{item.clients?.client_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                      {item.current_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ring-1 ring-inset
                      ${item.payment_status === 'Approved' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${item.payment_status === 'Approved' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                      {item.payment_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/dashboard/shipments/${item.awb_number}`} className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 group-hover:text-indigo-600 transition-colors">
                      Process <ArrowRight size={14} />
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