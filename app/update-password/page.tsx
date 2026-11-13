'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Password updated successfully! Redirecting to login...');
      setTimeout(() => router.push('/login'), 2000);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <form onSubmit={handleUpdate} className="bg-white p-8 rounded-2xl shadow-sm ring-1 ring-slate-200/60 w-96">
        <h1 className="text-2xl font-bold mb-6 text-center text-slate-800">Set New Password</h1>
        
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-2 rounded-lg border border-red-200">{error}</p>}
        {success && <p className="text-emerald-600 text-sm mb-4 bg-emerald-50 p-2 rounded-lg border border-emerald-200">{success}</p>}
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">New Password</label>
          <input type="password" className="border border-slate-200 p-2.5 w-full rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>

        <button type="submit" className="bg-indigo-600 text-white p-2.5 w-full rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20">
          Update Password
        </button>
      </form>
    </div>
  );
}