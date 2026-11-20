'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, Plus, Building2, Loader2, Ban, CheckCircle, Package, Users, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type Company = {
  id: string;
  name: string;
  status: string;
  subscription_tier: string | null;
  shipments?: { count: number }[];
};

export default function PlatformAdmin() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState({ totalCompanies: 0, totalUsers: 0, totalShipments: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [updatingCompanyId, setUpdatingCompanyId] = useState<string | null>(null);

  const fetchPlatformData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) { setIsAuthorized(false); return; }

      const { data: profile, error: profileError } = await supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single();
      if (profileError) throw profileError;
      if (!profile?.is_platform_admin) { setIsAuthorized(false); return; }
      setIsAuthorized(true);

      const [companiesResult, usersResult, shipmentsResult] = await Promise.all([
        supabase.from('companies').select('*, shipments(count)').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('shipments').select('*', { count: 'exact', head: true }),
      ]);
      if (companiesResult.error) throw companiesResult.error;
      if (usersResult.error) throw usersResult.error;
      if (shipmentsResult.error) throw shipmentsResult.error;

      const rows = (companiesResult.data || []) as Company[];
      setCompanies(rows);
      setStats({ totalCompanies: rows.length, totalUsers: usersResult.count || 0, totalShipments: shipmentsResult.count || 0 });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Unable to load platform data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchPlatformData(); }, [fetchPlatformData]);

  const handleCreateCompany = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isCreating) return;
    if (!newCompanyName.trim() || !newAdminEmail.trim()) return toast.error('Please fill all fields.');
    setIsCreating(true);
    try {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert([{ name: newCompanyName.trim(), status: 'Active', subscription_tier: 'Basic' }])
        .select()
        .single();
      if (companyError) throw companyError;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');

      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ email: newAdminEmail.trim(), role: 'Super Admin', department: 'Management', companyId: newCompany.id }),
      });
      const inviteData = await res.json();
      if (!res.ok) throw new Error(inviteData.error || 'Unable to invite the company administrator. The company remains listed so you can retry safely.');

      toast.success(`Company created and invite sent to ${newAdminEmail.trim()}.`);
      setNewCompanyName('');
      setNewAdminEmail('');
      await fetchPlatformData(true);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Company onboarding failed. If the company was created, it remains available for a safe invitation retry.');
      await fetchPlatformData(true);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleCompanyStatus = async (companyId: string, currentStatus: string) => {
    if (updatingCompanyId) return;
    const newStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    setUpdatingCompanyId(companyId);
    try {
      const { error } = await supabase.from('companies').update({ status: newStatus }).eq('id', companyId);
      if (error) throw error;
      toast.success(`Company ${newStatus === 'Active' ? 'reactivated' : 'suspended'}.`);
      setCompanies(current => current.map(c => c.id === companyId ? { ...c, status: newStatus } : c));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Unable to update company status.');
    } finally { setUpdatingCompanyId(null); }
  };

  const changeTier = async (companyId: string, newTier: string) => {
    if (updatingCompanyId) return;
    setUpdatingCompanyId(companyId);
    try {
      const { error } = await supabase.from('companies').update({ subscription_tier: newTier }).eq('id', companyId);
      if (error) throw error;
      toast.success(`Subscription changed to ${newTier}.`);
      setCompanies(current => current.map(c => c.id === companyId ? { ...c, subscription_tier: newTier } : c));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Unable to update subscription.');
      await fetchPlatformData(true);
    } finally { setUpdatingCompanyId(null); }
  };

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><div className="flex flex-col items-center gap-3"><Loader2 size={30} className="animate-spin text-indigo-600" /><p className="text-sm font-semibold text-slate-600">Loading platform workspace…</p><p className="text-xs text-slate-400">Retrieving tenant and usage information</p></div></div>;
  if (!isAuthorized) return <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center rounded-2xl border border-red-100 bg-white p-10 text-center shadow-sm"><ShieldCheck size={34} className="text-red-500" /><h1 className="mt-4 text-xl font-bold text-slate-900">Access denied</h1><p className="mt-2 text-sm text-slate-500">This workspace is restricted to the global Platform Administrator.</p></div>;

  const statCards = [
    { label: 'Total companies', value: stats.totalCompanies, icon: Building2, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Total users', value: stats.totalUsers, icon: Users, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Total shipments', value: stats.totalShipments, icon: Package, color: 'bg-amber-50 text-amber-600' },
  ];

  return <div className="space-y-7">
    <div id="overview" className="scroll-mt-24 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700"><ShieldCheck size={14} /> GLOBAL PLATFORM CONTROL</div><h1 className="text-3xl font-extrabold tracking-tight text-slate-950">SaaS Dashboard</h1><p className="mt-2 text-sm text-slate-500">Manage tenant companies, monitor platform usage and control access.</p></div>
      <button type="button" onClick={() => void fetchPlatformData(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60">{refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}{refreshing ? 'Refreshing…' : 'Refresh data'}</button>
    </div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {statCards.map(({ label, value, icon: Icon, color }) => <div key={label} className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div className={`rounded-xl p-3.5 ${color}`}><Icon size={25} /></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-3xl font-extrabold tabular-nums text-slate-950">{value.toLocaleString()}</p></div></div>)}
    </div>

    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <section id="onboard-company" className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="mb-5"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Plus size={20} /></div><h2 className="text-lg font-bold text-slate-950">Onboard a company</h2><p className="mt-1 text-sm leading-5 text-slate-500">Create a tenant and invite its first company administrator.</p></div>
        <form onSubmit={handleCreateCompany} className="space-y-4">
          <div><label htmlFor="company-name" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Company name</label><input id="company-name" type="text" value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} disabled={isCreating} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60" placeholder="e.g. Acme Logistics" required /></div>
          <div><label htmlFor="admin-email" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Administrator email</label><input id="admin-email" type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} disabled={isCreating} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60" placeholder="admin@company.com" required /></div>
          <button disabled={isCreating} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/15 transition hover:bg-indigo-700 disabled:cursor-wait disabled:bg-indigo-400">{isCreating ? <><Loader2 size={17} className="animate-spin" /> Creating company…</> : <><Plus size={17} /> Create company & invite admin</>}</button>
          <p className="text-xs leading-5 text-slate-400">The company is retained if invitation delivery fails, so you can safely retry the invitation.</p>
        </form>
      </section>

      <section id="tenant-companies" className="scroll-mt-24 min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="font-bold text-slate-950">Tenant companies</h2><p className="mt-0.5 text-xs text-slate-500">Manage subscription and account status</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{companies.length} total</span></div>
        {companies.length === 0 ? <div className="p-10 text-center"><Building2 size={28} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No tenant companies yet</p><p className="mt-1 text-xs text-slate-500">New companies will appear here after onboarding.</p></div> :
        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50/80"><tr><th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Company</th><th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Usage</th><th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Plan</th><th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th><th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{companies.map(company => {
            const shipmentCount = company.shipments?.[0]?.count || 0;
            const busy = updatingCompanyId === company.id;
            return <tr key={company.id} className="transition hover:bg-slate-50/70">
              <td className="whitespace-nowrap px-5 py-4"><p className="text-sm font-bold text-slate-900">{company.name}</p><p className="mt-0.5 text-[11px] text-slate-400">Tenant account</p></td>
              <td className="whitespace-nowrap px-5 py-4"><span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700">{shipmentCount.toLocaleString()} shipments</span></td>
              <td className="whitespace-nowrap px-5 py-4"><div className="relative"><select aria-label={`Subscription plan for ${company.name}`} value={company.subscription_tier || 'Basic'} disabled={Boolean(updatingCompanyId)} onChange={e => void changeTier(company.id, e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 pr-7 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 disabled:opacity-50"><option value="Basic">Basic</option><option value="Pro">Pro</option><option value="Enterprise">Enterprise</option></select>{busy && <Loader2 size={13} className="absolute -right-5 top-2 animate-spin text-indigo-600" />}</div></td>
              <td className="whitespace-nowrap px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${company.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}><span className={`h-1.5 w-1.5 rounded-full ${company.status === 'Active' ? 'bg-emerald-500' : 'bg-red-500'}`} />{company.status}</span></td>
              <td className="whitespace-nowrap px-5 py-4 text-right"><button type="button" disabled={Boolean(updatingCompanyId)} onClick={() => void toggleCompanyStatus(company.id, company.status)} title={company.status === 'Active' ? 'Suspend company' : 'Reactivate company'} aria-label={company.status === 'Active' ? `Suspend ${company.name}` : `Reactivate ${company.name}`} className={`inline-flex items-center justify-center rounded-lg p-2 transition disabled:cursor-wait disabled:opacity-40 ${company.status === 'Active' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>{busy ? <Loader2 size={18} className="animate-spin" /> : company.status === 'Active' ? <Ban size={18} /> : <CheckCircle size={18} />}</button></td>
            </tr>;
          })}</tbody>
        </table></div>}
      </section>
    </div>
  </div>;
}