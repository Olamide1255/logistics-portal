'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Package, Clock, CheckCircle, Truck, Plane, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Dashboard() {
  const [role, setRole] = useState<string>('Loading...');
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [stats, setStats] = useState({ total: 0, pendingFinance: 0, pendingFreight: 0, pendingRFS: 0, pendingOps: 0 });
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('role, is_platform_admin').eq('id', user.id).single();
    
    if (profile?.is_platform_admin) {
      setIsPlatformAdmin(true);
      setRole('Platform Admin');
      setLoading(false);
      return; // Stop here. Don't fetch shipments for Platform Admins.
    }

    let currentRole = profile?.role || 'Unknown';
    setRole(currentRole);

    const { data } = await supabase.from('shipments_secure').select('*, clients(client_name)').order('created_at', { ascending: false });
    
    if (data) {
      setStats({
        total: data.length,
        pendingFinance: data.filter(s => s.payment_status === 'Pending').length,
        pendingFreight: data.filter(s => s.payment_status === 'Approved' && s.current_status === 'Registered').length,
        pendingRFS: data.filter(s => s.current_status === 'Booked').length,
        pendingOps: data.filter(s => s.current_status === 'Picked Up' || s.current_status === 'Handed to Ops').length,
      });

      let filteredQueue = [];
      if (currentRole === 'Finance') filteredQueue = data.filter(s => s.payment_status === 'Pending');
      else if (currentRole === 'Freight') filteredQueue = data.filter(s => s.payment_status === 'Approved' && s.current_status === 'Registered');
      else if (currentRole === 'RFS') filteredQueue = data.filter(s => s.current_status === 'Booked');
      else if (currentRole === 'Operations') filteredQueue = data.filter(s => s.current_status === 'Picked Up' || s.current_status === 'Handed to Ops');
      else if (currentRole === 'Customer Service') filteredQueue = data.filter(s => s.current_status !== 'Delivered');
      else filteredQueue = data.filter(s => s.current_status !== 'Delivered');
      
      setQueue(filteredQueue);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();

    const channel = supabase
      .channel('dashboard-shipments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) return <div className="p-10 text-center text-slate-500 animate-pulse">Loading Dashboard...</div>;

  // SPECIAL VIEW FOR PLATFORM ADMIN
  if (isPlatformAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4">
        <div className="bg-indigo-50 p-6 rounded-full mb-6">
          <ShieldCheck size={48} className="text-indigo-600" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Welcome back, Platform Admin</h1>
        <p className="text-slate-500 max-w-md mb-8 font-medium">
          You are logged into the master platform account. You do not have a tenant shipment queue. 
          Use the SaaS Dashboard to manage companies, subscriptions, and onboarding.
        </p>
        <Link href="/platform" className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2">
          Go to SaaS Dashboard <ArrowRight size={20} />
        </Link>
      </div>
    );
  }

  // NORMAL TENANT VIEW
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome back, {role}</h1>
        <p className="text-slate-500 mt-1 font-medium">Here is your operational queue.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60 hover:shadow-md transition-all group">
          <div className="flex justify-between items-start">
            <div><p className="text-slate-500 text-sm font-semibold uppercase">Total</p><h3 className="text-3xl font-bold text-slate-900 mt-2">{stats.total}</h3></div>
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600"><Package size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60 hover:shadow-md transition-all group">
          <div className="flex justify-between items-start">
            <div><p className="text-slate-500 text-sm font-semibold uppercase">Finance</p><h3 className="text-3xl font-bold text-amber-500 mt-2">{stats.pendingFinance}</h3></div>
            <div className="p-3 bg-amber-50 rounded-xl text-amber-500"><Clock size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60 hover:shadow-md transition-all group">
          <div className="flex justify-between items-start">
            <div><p className="text-slate-500 text-sm font-semibold uppercase">Freight</p><h3 className="text-3xl font-bold text-blue-500 mt-2">{stats.pendingFreight}</h3></div>
            <div className="p-3 bg-blue-50 rounded-xl text-blue-500"><Plane size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60 hover:shadow-md transition-all group">
          <div className="flex justify-between items-start">
            <div><p className="text-slate-500 text-sm font-semibold uppercase">RFS</p><h3 className="text-3xl font-bold text-purple-500 mt-2">{stats.pendingRFS}</h3></div>
            <div className="p-3 bg-purple-50 rounded-xl text-purple-500"><Truck size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60 hover:shadow-md transition-all group">
          <div className="flex justify-between items-start">
            <div><p className="text-slate-500 text-sm font-semibold uppercase">Ops</p><h3 className="text-3xl font-bold text-emerald-500 mt-2">{stats.pendingOps}</h3></div>
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-500"><CheckCircle size={24} /></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div><h2 className="text-lg font-bold text-slate-900">My Action Queue</h2><p className="text-sm text-slate-500 mt-1">Shipments currently requiring your attention.</p></div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">AWB</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Client</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {queue.length === 0 && (<tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500"><CheckCircle className="mx-auto text-slate-300 mb-2" size={32}/>You're all caught up!</td></tr>)}
              {queue.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap"><Link href={`/dashboard/shipments/${encodeURIComponent(item.awb_number.trim())}`} className="font-bold text-indigo-600 hover:text-indigo-800">{item.awb_number}</Link></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">{item.clients?.client_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ring-1 ring-inset ${item.shipment_type === 'Import' ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-orange-50 text-orange-700 ring-orange-200'}`}>{item.shipment_type}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200">{item.current_status}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><Link href={`/dashboard/shipments/${encodeURIComponent(item.awb_number.trim())}`} className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 group-hover:text-indigo-600 transition-colors">Process <ArrowRight size={14} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}