
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, UserCog } from 'lucide-react';
import { toast, Toaster } from 'sonner';

type AdminProfile = {
  id: string;
  email: string | null;
  role: string | null;
  is_platform_admin: boolean | null;
};

export default function AdminUsers() {
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const fetchProfiles = async () => {
      setLoadError(false);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setLoadError(true);
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      const { data: myProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role, company_id, is_platform_admin')
        .eq('id', user.id)
        .single();

      if (profileError) {
        setLoadError(true);
        setLoading(false);
        return;
      }

      if (myProfile?.role === 'Super Admin' && !myProfile.is_platform_admin) {
        setIsSuperAdmin(true);
        setCurrentCompanyId(myProfile.company_id);

        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, role, is_platform_admin')
          .eq('company_id', myProfile.company_id)
          .order('email', { ascending: true });

        if (data) setProfiles(data);
        if (error) {
          console.error(error);
          setLoadError(true);
        }
      }

      setLoading(false);
    };

    void fetchProfiles();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId);

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
      .eq('company_id', currentCompanyId || '');

    if (error) {
      toast.error('Failed to update role: ' + error.message);
    } else {
      toast.success('Role updated successfully');
      setProfiles((currentProfiles) =>
        currentProfiles.map((profile) =>
          profile.id === userId ? { ...profile, role: newRole } : profile
        )
      );
    }

    setUpdatingId(null);
  };

  if (loading) {
    return (
      <div className="p-10 text-center text-slate-500 animate-pulse">
        Loading users...
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-5 rounded-2xl bg-rose-50 p-5 text-rose-600">
          <ShieldAlert size={36} />
        </div>

        <h1 className="text-xl font-bold text-slate-900">
          {loadError ? 'We could not verify your access' : 'Access restricted'}
        </h1>

        <p className="mt-2 max-w-md text-sm text-slate-500">
          {loadError
            ? 'Your user information could not be loaded. Please refresh and try again.'
            : 'Only a company Super Admin can manage employee roles.'}
        </p>

        {loadError && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Reload page
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" richColors />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            User Management
          </h1>
          <p className="text-slate-500 mt-1 font-medium">
            Manage employee access and role assignments.
          </p>
        </div>

        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm ring-1 ring-indigo-500/10">
          <UserCog size={28} />
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          User records could not be loaded.{' '}
          <button
            type="button"
            onClick={() => {
              setLoading(true);

              void (async () => {
                const {
                  data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                  setLoadError(true);
                  setLoading(false);
                  return;
                }

                const { data: me, error: meError } = await supabase
                  .from('profiles')
                  .select('role, company_id, is_platform_admin')
                  .eq('id', user.id)
                  .single();

                if (meError) {
                  setLoadError(true);
                  setLoading(false);
                  return;
                }

                if (me?.role === 'Super Admin' && !me.is_platform_admin) {
                  setIsSuperAdmin(true);
                  setCurrentUserId(user.id);
                  setCurrentCompanyId(me.company_id);

                  const { data, error } = await supabase
                    .from('profiles')
                    .select('id, email, role, is_platform_admin')
                    .eq('company_id', me.company_id)
                    .order('email', { ascending: true });

                  if (error) {
                    setLoadError(true);
                  } else {
                    setProfiles(data || []);
                    setLoadError(false);
                  }
                } else {
                  setIsSuperAdmin(false);
                }

                setLoading(false);
              })();
            }}
            className="ml-2 font-bold underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">
                  Email Address
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">
                  Current Role
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">
                  Change Role
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-slate-100">
              {!loadError && profiles.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    No employee accounts found for this company yet.
                  </td>
                </tr>
              )}

              {profiles.map((profile) => (
                <tr
                  key={profile.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                    {profile.email || 'No email'}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200">
                      {profile.role || 'Unassigned'}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <select
                        value={profile.role || ''}
                        onChange={(e) =>
                          handleRoleChange(profile.id, e.target.value)
                        }
                        disabled={
                          updatingId === profile.id ||
                          profile.id === currentUserId ||
                          !!profile.is_platform_admin
                        }
                        aria-label={`Change role for ${profile.email || 'No email'}`}
                        title={
                          profile.id === currentUserId
                            ? 'You cannot change your own role here.'
                            : !!profile.is_platform_admin
                              ? 'Platform administrator roles are managed separately.'
                              : 'Change employee role'
                        }
                        className="border border-slate-200 p-2 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="Super Admin" disabled>Super Admin</option>
                        <option value="Customer Service">Customer Service</option>
                        <option value="Finance">Finance</option>
                        <option value="Freight">Freight</option>
                        <option value="RFS">RFS</option>
                        <option value="Operations">Operations</option>
                        <option value="Unknown">Unknown</option>
                      </select>

                      {updatingId === profile.id && (
                        <span className="text-xs text-indigo-600 animate-pulse font-medium">
                          Saving...
                        </span>
                      )}
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
