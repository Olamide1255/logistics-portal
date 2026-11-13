'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    // IMPORTANT: Make sure this redirects to your live Vercel URL in production
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('If an account exists, a password reset link has been sent to your email.');
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <form onSubmit={handleReset} className="bg-white p-8 rounded-2xl shadow-sm ring-1 ring-slate-200/60 w-96">
        <h1 className="text-2xl font-bold mb-2 text-center text-slate-800">Reset Password</h1>
        <p className="text-slate-500 text-sm text-center mb-6">Enter your email to receive a reset link.</p>
        
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-2 rounded-lg border border-red-200">{error}</p>}
        {message && <p className="text-emerald-600 text-sm mb-4 bg-emerald-50 p-2 rounded-lg border border-emerald-200">{message}</p>}
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">Email</label>
          <input type="email" className="border border-slate-200 p-2.5 w-full rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <button type="submit" className="bg-indigo-600 text-white p-2.5 w-full rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 mb-4">
          Send Reset Link
        </button>
        
        <div className="text-center">
          <Link href="/login" className="text-sm text-slate-500 hover:text-slate-800">Back to Login</Link>
        </div>
      </form>
    </div>
  );
}
