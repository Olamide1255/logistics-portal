'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, ShieldAlert, UserCog } from 'lucide-react';
import { toast, Toaster } from 'sonner';

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [companyId, setCompanyId] = useState<string>('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      if (profile?.role !== 'Super Admin' && !profile?.is_platform_admin) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      setIsAuthorized(true);
      setCompanyId(profile.company_id);

      // Fetch only employees belonging to this company
      const { data: emps } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('email', { ascending: true });
      
      if (emps) setEmployees(emps);
      setLoading(false);
    };
    fetchEmployees();
  }, []);

  const handleUpdate = async (userId: string, field: 'role' | 'department', value: string) => {
    setUpdatingId(userId);
    const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', userId).eq('company_id', companyId);
    
    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      toast.success(`Employee ${field} updated.`);
      setEmployees(employees.map(e => e.id === userId ? { ...e, [field]: value } : e));
    }
    setUpdatingId(null);
  };

  if (loading) return <div className="p-10 text-center animate-pulse">Loading employees...</div>;
  if (!isAuthorized) return <div className="p-10 text-center text-red-500 font-bold flex items-center justify-center gap-2"><ShieldAlert/> Access Denied. Only Company Admins can view this.</div>;

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
      </div>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Employee Email</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Role (Permissions)</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Department</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50/80">
                <td className="px-6 py-4 font-bold text-slate-900">{emp.email}</td>
                
                {/* ROLE SELECTOR */}
                <td className="px-6 py-4">
                  <select 
                    value={emp.role} 
                    onChange={(e) => handleUpdate(emp.id, 'role', e.target.value)}
                    disabled={updatingId === emp.id || emp.is_platform_admin}
                    className="border border-slate-200 p-2 rounded-lg text-sm text-slate-900 bg-white disabled:opacity-50"
                  >
                    <option value="Super Admin">Super Admin (Company)</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="Finance">Finance</option>
                    <option value="Freight">Freight</option>
                    <option value="RFS">RFS</option>
                    <option value="Operations">Operations</option>
                  </select>
                </td>

                {/* DEPARTMENT SELECTOR */}
                <td className="px-6 py-4">
                  <select 
                    value={emp.department || 'Unassigned'} 
                    onChange={(e) => handleUpdate(emp.id, 'department', e.target.value)}
                    disabled={updatingId === emp.id || emp.is_platform_admin}
                    className="border border-slate-200 p-2 rounded-lg text-sm text-slate-900 bg-white disabled:opacity-50"
                  >
                    <option value="Unassigned">Unassigned</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="Finance">Finance</option>
                    <option value="Freight">Freight</option>
                    <option value="RFS">RFS</option>
                    <option value="Operations">Operations</option>
                    <option value="Management">Management</option>
                  </select>
                </td>

                <td className="px-6 py-4">
                   <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-emerald-200">Active</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}