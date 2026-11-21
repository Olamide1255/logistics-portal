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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const fetchProfiles = async () => {
      setLoadError(false);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { setLoadError(true); setLoading(false); return; }
      setCurrentUserId(user.id);

      // Check if current user is Super Admin
      const { data: myProfile, error: profileError } = await supabase.from('profiles').select('role, company_id, is_platform_admin').eq('id', user.id).single();
      if (profileError) { setLoadError(true); setLoading(false); return; }
      if (myProfile?.role === 'Super Admin' && !myProfile.is_platform_admin) {
        setIsSuperAdmin(true);

        // Fetch all users
        const { data, error } = await supabase.from('profiles').select('id, email, role, is_platform_admin').eq('company_id', myProfile.company_id).order('email', { ascending: true });
        if (data) setProfiles(data);
        if (error) { console.error(error); setLoadError(true); }
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

      {loadError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">User records could not be loaded. <button type="button" onClick={() => { setLoading(true); void (async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) { setLoading(false); return; } const { data: me } = await supabase.from('profiles').select('role, company_id, is_platform_admin').eq('id', user.id).single(); if (me?.role === 'Super Admin' && !me.is_platform_admin) { const { data, error } = await supabase.from('profiles').select('id, email, role, is_platform_admin').eq('company_id', me.company_id).order('email'); if (!error) { setProfiles(data || []); setLoadError(false); } } setLoading(false); })(); }} className="ml-2 font-bold underline">Retry</button></div>}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60"><div className="overflow-x-auto">
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
              {!loadError && profiles.length === 0 && <tr><td colSpan={3} className="px-6 py-12 text-center text-sm text-slate-500">No employee accounts found for this company yet.</td></tr>}
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
                        disabled={updatingId === profile.id || profile.id === currentUserId || profile.is_platform_admin} aria-label={`Change role for ${profile.email}`} title={profile.id === currentUserId ? 'You cannot change your own role here.' : profile.is_platform_admin ? 'Platform administrator roles are managed separately.' : 'Change employee role'}
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
        </div></div>
      </div>
    </div>
  );
}