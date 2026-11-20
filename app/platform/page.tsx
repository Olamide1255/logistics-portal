'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, Plus, Building2, Loader2, Trash2, Ban, CheckCircle, Package, Users, Crown } from 'lucide-react';
import { toast, Toaster } from 'sonner';

export default function PlatformAdmin() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalCompanies: 0, totalUsers: 0, totalShipments: 0 });
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchPlatformData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single();
    if (!profile?.is_platform_admin) {
      setIsAuthorized(false);
      setLoading(false);
      return;
    }
    
    setIsAuthorized(true);

    // Fetch Companies with Shipment Count
    const { data: comps } = await supabase
      .from('companies')
      .select('*, shipments(count)')
      .order('created_at', { ascending: false });
      
    if (comps) setCompanies(comps);

    const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: shipmentCount } = await supabase.from('shipments').select('*', { count: 'exact', head: true });

    setStats({
      totalCompanies: comps?.length || 0,
      totalUsers: userCount || 0,
      totalShipments: shipmentCount || 0
    });

    setLoading(false);
  };

  useEffect(() => {
    fetchPlatformData();
  }, []);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName || !newAdminEmail) return toast.error("Please fill all fields.");
    setIsCreating(true);
    let createdCompanyId: string | null = null;

    try {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert([{ name: newCompanyName, status: 'Active', subscription_tier: 'Basic' }])
        .select()
        .single();
      
      if (companyError) throw companyError;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: newAdminEmail,
          role: 'Super Admin',
          department: 'Management',
          companyId: newCompany.id,
        }),
      });

      const inviteData = await res.json();
      if (!res.ok) throw new Error(inviteData.error || 'Unable to invite the company administrator.');
      
      toast.success(`Company created and invite sent to ${newAdminEmail}!`);
      fetchPlatformData(); 
      setNewCompanyName('');
      setNewAdminEmail('');
    } catch (error: unknown) {
      if (createdCompanyId) {
        const { error: cleanupError } = await supabase.from('companies').delete().eq('id', createdCompanyId);
        if (cleanupError) console.error('Could not clean up the company after invitation failure:', cleanupError);
      }
      toast.error(error instanceof Error ? error.message : 'Company onboarding failed.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCompany = async (companyId: string, companyName: string) => {
    if (!window.confirm(`DANGER: Are you sure you want to delete "${companyName}" and ALL its data?`)) return;
    try {
      const { error } = await supabase.from('companies').delete().eq('id', companyId);
      if (error) throw error;
      toast.success(`Company deleted.`);
      fetchPlatformData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleCompanyStatus = async (companyId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    const { error } = await supabase.from('companies').update({ status: newStatus }).eq('id', companyId);
    if (error) toast.error(error.message);
    else {
      toast.success(`Company ${newStatus === 'Active' ? 'reactivated' : 'suspended'}.`);
      setCompanies(companies.map(c => c.id === companyId ? { ...c, status: newStatus } : c));
    }
  };

  const changeTier = async (companyId: string, newTier: string) => {
    const { error } = await supabase.from('companies').update({ subscription_tier: newTier }).eq('id', companyId);
    if (error) toast.error(error.message);
    else {
      toast.success(`Subscription changed to ${newTier}.`);
      setCompanies(companies.map(c => c.id === companyId ? { ...c, subscription_tier: newTier } : c));
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500 animate-pulse">Verifying Platform Access...</div>;
  if (!isAuthorized) return <div className="p-10 text-center text-red-500 font-bold flex items-center justify-center gap-2"><ShieldCheck /> Access Denied.</div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <Toaster position="top-right" richColors />
      
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <ShieldCheck className="text-indigo-600" size={32} /> LogiFlow Platform Admin
        </h1>
        <p className="text-slate-500 mt-1 font-medium">Manage SaaS companies, monitor usage, and control access.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60 flex items-center gap-4">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-xl"><Building2 size={28} /></div>
          <div><p className="text-slate-500 text-sm font-bold uppercase">Total Companies</p><h3 className="text-3xl font-extrabold text-slate-900">{stats.totalCompanies}</h3></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60 flex items-center gap-4">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl"><Users size={28} /></div>
          <div><p className="text-slate-500 text-sm font-bold uppercase">Total Users</p><h3 className="text-3xl font-extrabold text-slate-900">{stats.totalUsers}</h3></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60 flex items-center gap-4">
          <div className="p-4 bg-amber-50 text-amber-600 rounded-xl"><Package size={28} /></div>
          <div><p className="text-slate-500 text-sm font-bold uppercase">Total Shipments</p><h3 className="text-3xl font-extrabold text-slate-900">{stats.totalShipments}</h3></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* CREATE COMPANY FORM */}
        <div className="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60 h-fit">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Plus size={18}/> Onboard Client</h2>
          <form onSubmit={handleCreateCompany} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company Name</label>
              <input type="text" value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" placeholder="e.g. DHL Express" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Admin Email</label>
              <input type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" placeholder="admin@dhl.com" required />
            </div>
            <button disabled={isCreating} type="submit" className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl hover:bg-indigo-700 transition-all flex justify-center items-center gap-2">
              {isCreating ? <Loader2 className="animate-spin" size={18} /> : 'Create Company'}
            </button>
          </form>
        </div>

        {/* COMPANIES LIST */}
        <div className="md:col-span-3 bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h2 className="font-bold text-slate-800 flex items-center gap-2"><Building2 size={18}/> Active Tenants</h2>
          </div>
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Company</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Usage</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Tier</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {companies.map(c => {
                const shipmentCount = c.shipments?.[0]?.count || 0;
                return (
                  <tr key={c.id} className="hover:bg-slate-50 group">
                    <td className="px-6 py-4 font-bold text-slate-900">{c.name}</td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-700 py-1 px-3 rounded-md text-xs font-bold ring-1 ring-inset ring-slate-200">
                        {shipmentCount} Shipments
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={c.subscription_tier || 'Basic'} 
                        onChange={(e) => changeTier(c.id, e.target.value)}
                        className="border border-slate-200 p-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white"
                      >
                        <option value="Basic">Basic</option>
                        <option value="Pro">Pro</option>
                        <option value="Enterprise">Enterprise</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${c.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{c.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button onClick={() => toggleCompanyStatus(c.id, c.status)} className={`p-2 rounded-lg ${c.status === 'Active' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`} title={c.status === 'Active' ? 'Suspend' : 'Activate'}>
                        {c.status === 'Active' ? <Ban size={18} /> : <CheckCircle size={18} />}
                      </button>
                      <button onClick={() => handleDeleteCompany(c.id, c.name)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg opacity-0 group-hover:opacity-100" title="Delete">
                        <Trash2 size={18} />
                      </button>
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