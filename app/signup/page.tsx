'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Loader2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';

export default function Signup() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ companyName: '', email: '', password: '' });

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/signup-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        // Show the specific error from the API (rate limit, duplicate, validation, etc.)
        throw new Error(data.error || 'Signup failed. Please try again.');
      }

      toast.success("Workspace created! Redirecting to login...");
      setTimeout(() => router.push('/login'), 2000);
    } catch (error: any) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Toaster position="top-right" richColors />
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm ring-1 ring-slate-200/60">
        
        <div className="flex justify-center mb-6">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-md">
            <Package size={28} />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">Create your Workspace</h1>
        <p className="text-center text-slate-500 text-sm mb-8">Set up your company on LogiFlow</p>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Company Name</label>
            <input required type="text" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="e.g. Acme Freight Ltd" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Admin Email</label>
            <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="admin@acmefreight.com" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
            <input required type="password" minLength={6} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full border border-slate-200 p-3 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="Min. 6 characters" />
          </div>
          <button disabled={loading} type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all flex justify-center items-center gap-2 mt-4">
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Create Workspace'}
          </button>
        </form>
        
        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account? <Link href="/login" className="text-indigo-600 font-bold hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}