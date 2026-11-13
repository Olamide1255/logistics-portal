'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, UserCog, Save } from 'lucide-react';
import { toast, Toaster } from 'sonner';

export default function AdminUsers() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Check if current user is Super Admin
      const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (myProfile?.role === 'Super Admin') {
        setIsSuperAdmin(true);

        // Fetch all users
        const { data, error } = await supabase.from('profiles').select('*').order('email', { ascending: true });
        if (data) setProfiles(data);
        if (error) console.error(error);
      }
      setLoading(false);
    };
    fetchProfiles();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    
    if (error) {
      toast.error("Failed to update role: " + error.message);
    } else {
      toast.success("Role updated successfully");
      setProfiles(profiles.map(p => p.id === userId ? { ...p, role: newRole } : p));
    }
    setUpdatingId(null);
  };

  if (loading) return <div className="p-10 text-center text-slate-500 animate-pulse">Loading users...</div>;

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="bg-red-50 p-6 rounded-full mb-6"><ShieldAlert size={48} className="text-red-500" /></div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-slate-500 max-w-md mb-6">Only Super Admins can access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" richColors />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">User Management</h1>
          <p className="text-slate-500 mt-1 font-medium">Manage employee access and role assignments.</p>
        </div>
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm ring-1 ring-indigo-500/10">
          <UserCog size={28} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Email Address</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Current Role</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Change Role</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {profiles.map((profile) => (
                <tr key={profile.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">{profile.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200">
                      {profile.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <select 
                        value={profile.role} 
                        onChange={(e) => handleRoleChange(profile.id, e.target.value)}
                        disabled={updatingId === profile.id || profile.email === 'it@marchloglimited.org.ng'} // Prevent self-lockout
                        className="border border-slate-200 p-2 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="Super Admin">Super Admin</option>
                        <option value="Customer Service">Customer Service</option>
                        <option value="Finance">Finance</option>
                        <option value="Freight">Freight</option>
                        <option value="RFS">RFS</option>
                        <option value="Operations">Operations</option>
                        <option value="Unknown">Unknown</option>
                      </select>
                      {updatingId === profile.id && <span className="text-xs text-indigo-600 animate-pulse font-medium">Saving...</span>}
                    </div>
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