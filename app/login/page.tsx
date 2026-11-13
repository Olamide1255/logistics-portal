'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-sm ring-1 ring-slate-200/60 w-96">
        <h1 className="text-2xl font-bold mb-6 text-center text-indigo-600">Marchlog Portal</h1>
        
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-2 rounded-lg border border-red-200">{error}</p>}
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">Email</label>
          <input type="email" className="border border-slate-200 p-2.5 w-full rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">Password</label>
          <input type="password" className="border border-slate-200 p-2.5 w-full rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <div className="text-right mb-6">
          <Link href="/forgot-password" className="text-sm text-indigo-600 hover:underline font-medium">Forgot Password?</Link>
        </div>

        <button type="submit" className="bg-indigo-600 text-white p-2.5 w-full rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20">
          Login
        </button>
      </form>
    </div>
  );
}