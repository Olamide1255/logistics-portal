'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, ShieldAlert, Plus, X, Loader2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [companyId, setCompanyId] = useState<string>('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Customer Service');
  const [inviteDept, setInviteDept] = useState('Customer Service');
  const [isInviting, setIsInviting] = useState(false);

  const fetchEmployees = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    console.log('DEBUG: Logged in user ID:', user.id);
    console.log('DEBUG: Logged in user email:', user.email);

    // Fetch profile with more detailed logging
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    console.log('DEBUG: Profile data:', profile);
    console.log('DEBUG: Profile error:', profileError);
    console.log('DEBUG: Profile company_id:', profile?.company_id);

    if (profile?.role !== 'Super Admin' && !profile?.is_platform_admin) {
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    setIsAuthorized(true);
    setCompanyId(profile.company_id);

    // Fetch employees with explicit logging
    const { data: emps, error: empsError, count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .eq('company_id', profile.company_id)
      .order('email', { ascending: true });
    
    console.log('DEBUG: Employees fetched:', emps?.length);
    console.log('DEBUG: Employees list:', emps);
    console.log('DEBUG: Employees error:', empsError);
    console.log('DEBUG: Total count:', count);

    if (emps) setEmployees(emps);
    setLoading(false);
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

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
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          department: inviteDept,
          companyId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Invite sent to ${inviteEmail}!`);
      setShowInvite(false);
      setInviteEmail('');
      fetchEmployees();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsInviting(false);
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse">Loading employees...</div>;
  if (!isAuthorized) return <div className="p-10 text-center text-red-500 font-bold flex items-center justify-center gap-2"><ShieldAlert/> Access Denied.</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Toaster position="top-right" richColors />
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="text-indigo-600" size={32} /> Employee Management
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Manage access, roles, and departments for your team.</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md">
          <Plus size={18} /> Invite Employee
        </button>
      </div>

      {showInvite && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Invite New Employee</h3>
              <button onClick={() => setShowInvite(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" placeholder="employee@company.com" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role (Permissions)</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900 bg-white">
                  <option value="Customer Service">Customer Service</option>
                  <option value="Finance">Finance</option>
                  <option value="Freight">Freight</option>
                  <option value="RFS">RFS</option>
                  <option value="Operations">Operations</option>
                  <option value="Super Admin">Super Admin (Admin)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Department</label>
                <select value={inviteDept} onChange={e => setInviteDept(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900 bg-white">
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
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Employee Email</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Role</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Department</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50/80">
                <td className="px-6 py-4 font-bold text-slate-900">{emp.email}</td>
                <td className="px-6 py-4">
                  <select value={emp.role} onChange={(e) => handleUpdate(emp.id, 'role', e.target.value)} disabled={updatingId === emp.id || emp.is_platform_admin} className="border border-slate-200 p-2 rounded-lg text-sm text-slate-900 bg-white disabled:opacity-50">
                    <option value="Super Admin">Super Admin</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="Finance">Finance</option>
                    <option value="Freight">Freight</option>
                    <option value="RFS">RFS</option>
                    <option value="Operations">Operations</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <select value={emp.department || 'Unassigned'} onChange={(e) => handleUpdate(emp.id, 'department', e.target.value)} disabled={updatingId === emp.id || emp.is_platform_admin} className="border border-slate-200 p-2 rounded-lg text-sm text-slate-900 bg-white disabled:opacity-50">
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
        </table>
      </div>
    </div>
  );
}