'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, ShieldAlert, Plus, X, Loader2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [companyId, setCompanyId] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Customer Service');
  const [inviteDept, setInviteDept] = useState('Customer Service');
  const [isInviting, setIsInviting] = useState(false);

  const fetchEmployees = useCallback(async (targetPage = page) => {
    setLoadError(false);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) { setLoadError(true); setLoading(false); return; }
    if (!user) {
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, company_id, is_platform_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    // Tenant team management is reserved for the tenant Super Admin.
    if (profile?.role !== 'Super Admin' || profile?.is_platform_admin) {
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    setIsAuthorized(true);
    setCompanyId(profile.company_id);

    // Load employees for the authenticated company.
    const { data: emps, error: empsError } = await supabase
      .from('profiles')
      .select('id, email, role, department, is_platform_admin', { count: 'exact' })
      .eq('company_id', profile.company_id)
      .order('email', { ascending: true })
      .range(targetPage * PAGE_SIZE, targetPage * PAGE_SIZE + PAGE_SIZE - 1);
    
    if (empsError) setLoadError(true);
    else {
      setEmployees(emps || []);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    void fetchEmployees(page);
  }, [fetchEmployees, page]);

  const handleUpdate = async (userId: string, field: 'role' | 'department', value: string) => {
    setUpdatingId(userId);
    const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', userId).eq('company_id', companyId);
    
    if (error) toast.error("Failed to update: " + error.message);
    else {
      toast.success(`Employee ${field} updated.`);
      setEmployees(employees.map(e => e.id === userId ? { ...e, [field]: value } : e));
    }
    setUpdatingId(null);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);

    try {
      // Get the current session so we can send the auth token to the API
const { data: { session } } = await supabase.auth.getSession();
const res = await fetch('/api/invite', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}` 
  },
  body: JSON.stringify({ email: inviteEmail, role: inviteRole, department: inviteDept, companyId })
});

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Invite sent to ${inviteEmail}!`);
      setShowInvite(false);
      setInviteEmail('');
      if (page === 0) await fetchEmployees(0);
      else setPage(0);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsInviting(false);
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse">Loading employees...</div>;
  if (!isAuthorized) return <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-4 text-center"><div className="mb-4 rounded-2xl bg-rose-50 p-4 text-rose-600"><ShieldAlert size={30}/></div><h1 className="text-xl font-bold text-slate-900">Team access restricted</h1><p className="mt-2 text-sm text-slate-500">Only your company&apos;s Super Admin can manage employee access.</p></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Toaster position="top-right" richColors />
      
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="text-indigo-600" size={32} /> Employee Management
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Manage access, roles, and departments for your team.</p><p className="mt-1 text-xs text-slate-400">{totalCount.toLocaleString()} team members</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md">
          <Plus size={18} /> Invite Employee
        </button>
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowInvite(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="invite-employee-title" className="my-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 id="invite-employee-title" className="font-bold text-slate-800">Invite New Employee</h3>
              <button type="button" onClick={() => setShowInvite(false)} aria-label="Close invite dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"><X size={20}/></button>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label htmlFor="invite-employee-email" className="mb-1 block text-xs font-bold uppercase text-slate-500">Email Address</label>
                <input id="invite-employee-email" type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" placeholder="employee@company.com" />
              </div>
              <div>
                <label htmlFor="invite-employee-role" className="mb-1 block text-xs font-bold uppercase text-slate-500">Role (Permissions)</label>
                <select id="invite-employee-role" value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900 bg-white">
                  <option value="Customer Service">Customer Service</option>
                  <option value="Finance">Finance</option>
                  <option value="Freight">Freight</option>
                  <option value="RFS">RFS</option>
                  <option value="Operations">Operations</option>
                  <option value="Super Admin">Super Admin (Admin)</option>
                </select>
              </div>
              <div>
                <label htmlFor="invite-employee-department" className="mb-1 block text-xs font-bold uppercase text-slate-500">Department</label>
                <select id="invite-employee-department" value={inviteDept} onChange={e => setInviteDept(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900 bg-white">
                  <option value="Customer Service">Customer Service</option>
                  <option value="Finance">Finance</option>
                  <option value="Freight">Freight</option>
                  <option value="RFS">RFS</option>
                  <option value="Operations">Operations</option>
                  <option value="Management">Management</option>
                </select>
              </div>
              <button type="submit" disabled={isInviting} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all flex justify-center items-center gap-2 mt-2">
                {isInviting ? <Loader2 className="animate-spin" size={18} /> : 'Send Invite Link'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60"><table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Employee Email</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Role</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Department</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {loadError && <tr><td colSpan={3} className="px-6 py-10 text-center"><p className="font-semibold text-rose-700">Employee records could not be loaded.</p><button type="button" onClick={() => { setLoading(true); void fetchEmployees(page); }} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Try again</button></td></tr>}
            {!loadError && employees.length === 0 && <tr><td colSpan={3} className="px-6 py-12 text-center"><div className="font-semibold text-slate-800">No employees found yet</div><p className="mt-1 text-sm text-slate-500">Invite a teammate to start building your workspace team.</p></td></tr>}
            {!loadError && employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50/80">
                <td className="px-6 py-4 font-bold text-slate-900">{emp.email}</td>
                <td className="px-6 py-4">
                  <label className="sr-only" htmlFor={`employee-role-${emp.id}`}>Role for {emp.email}</label><select id={`employee-role-${emp.id}`} value={emp.role} onChange={(e) => handleUpdate(emp.id, 'role', e.target.value)} disabled={updatingId === emp.id || emp.is_platform_admin || emp.id === currentUserId} aria-label={`Role for ${emp.email}`} title={emp.id === currentUserId ? 'You cannot change your own role.' : 'Update employee role'} className="border border-slate-200 p-2 rounded-lg text-sm text-slate-900 bg-white disabled:opacity-50">
                    <option value="Super Admin">Super Admin</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="Finance">Finance</option>
                    <option value="Freight">Freight</option>
                    <option value="RFS">RFS</option>
                    <option value="Operations">Operations</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <label className="sr-only" htmlFor={`employee-department-${emp.id}`}>Department for {emp.email}</label><select id={`employee-department-${emp.id}`} value={emp.department || 'Unassigned'} onChange={(e) => handleUpdate(emp.id, 'department', e.target.value)} disabled={updatingId === emp.id || emp.is_platform_admin} className="border border-slate-200 p-2 rounded-lg text-sm text-slate-900 bg-white disabled:opacity-50">
                    <option value="Unassigned">Unassigned</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="Finance">Finance</option>
                    <option value="Freight">Freight</option>
                    <option value="RFS">RFS</option>
                    <option value="Operations">Operations</option>
                    <option value="Management">Management</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {totalCount > PAGE_SIZE && <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()} employees</p>
          <div className="flex gap-2">
            <button type="button" disabled={page === 0 || loading} onClick={() => setPage(value => Math.max(0, value - 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40">Previous</button>
            <button type="button" disabled={(page + 1) * PAGE_SIZE >= totalCount || loading} onClick={() => setPage(value => value + 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40">Next</button>
          </div>
        </div>}
      </div>
    </div>
  );
}