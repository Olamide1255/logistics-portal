'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, Plus, Building2, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PlatformAdmin() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // New Company Form State
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlatformData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Verify the user is a platform admin
      const { data: profile } = await supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single();
      
      if (!profile?.is_platform_admin) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }
      
      setIsAuthorized(true);

      // Fetch all companies on the platform
      const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
      if (data) setCompanies(data);
      setLoading(false);
    };
    fetchPlatformData();
  }, []);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName || !newAdminEmail) return toast.error("Please fill all fields.");
    setIsCreating(true);

    try {
      // 1. Create the Company
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert([{ name: newCompanyName, status: 'Active' }])
        .select()
        .single();
      
      if (companyError) throw companyError;

      // Note: In a full SaaS, you would trigger an Edge Function here to 
      // use the Supabase Admin API to create the user and send an invite.
      // For now, we will manually create the user in Supabase Dashboard and link them.
      
      toast.success(`Company ${newCompanyName} created! Remember to create the Admin user in Supabase Auth and link their company_id to ${newCompany.id}`);
      
      setCompanies([newCompany, ...companies]);
      setNewCompanyName('');
      setNewAdminEmail('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCompany = async (companyId: string, companyName: string) => {
    if (!window.confirm(`DANGER: Are you sure you want to delete "${companyName}" and ALL its users? This cannot be undone.`)) return;
    
    setDeletingId(companyId);
    try {
      const res = await fetch('/api/delete-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success(`Company ${companyName} deleted.`);
      setCompanies(companies.filter(c => c.id !== companyId));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500 animate-pulse">Verifying Platform Access...</div>;
  
  if (!isAuthorized) {
    return <div className="p-10 text-center text-red-500 font-bold">Access Denied. Platform Admins Only.</div>;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <ShieldCheck className="text-indigo-600" size={32} /> LogiFlow Platform Admin
        </h1>
        <p className="text-slate-500 mt-1 font-medium">Manage SaaS companies, subscriptions, and onboarding.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CREATE COMPANY FORM */}
        <div className="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200/60 h-fit">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Plus size={18}/> Onboard New Company</h2>
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
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h2 className="font-bold text-slate-800 flex items-center gap-2"><Building2 size={18}/> Active Companies</h2>
            <span className="bg-indigo-100 text-indigo-700 py-1 px-3 rounded-full text-xs font-bold">{companies.length} Tenants</span>
          </div>
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Company Name</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Joined</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {companies.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 group">
                  <td className="px-6 py-4 font-bold text-slate-900">{c.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${c.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{c.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDeleteCompany(c.id, c.name)}
                      disabled={deletingId === c.id}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100 disabled:cursor-wait"
                      title="Delete Company & All Users"
                    >
                      {deletingId === c.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                    </button>
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