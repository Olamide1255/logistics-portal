'use client';
import { trackProductEvent } from '@/lib/product-analytics';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Loader2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';

export default function Signup() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ companyName: '', email: '', password: '' });

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/signup-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Signup failed. Please try again.');
      }

      trackProductEvent('workspace_signup_completed');
      router.push('/thank-you');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to create your workspace.';
      setError(message);
      toast.error(message);
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
        <p className="text-center text-slate-500 text-sm mb-8">Set up your company on LogiFlow. We’ll send a verification link to the admin email.</p>

        {error && <div role="alert" aria-live="polite" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label htmlFor="company-name" className="block text-sm font-bold text-slate-700 mb-1">Company Name</label>
            <input
              id="company-name"
              name="organization"
              autoComplete="organization"
              required
              minLength={2}
              maxLength={120}
              type="text"
              value={formData.companyName}
              onChange={e => setFormData({ ...formData, companyName: e.target.value })}
              disabled={loading}
              className="w-full border border-slate-200 p-3 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
              placeholder="e.g. Acme Freight Ltd"
            />
          </div>
          <div>
            <label htmlFor="admin-email" className="block text-sm font-bold text-slate-700 mb-1">Admin Email</label>
            <input
              id="admin-email"
              name="email"
              autoComplete="email"
              required
              maxLength={254}
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              disabled={loading}
              className="w-full border border-slate-200 p-3 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
              placeholder="admin@acmefreight.com"
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="block text-sm font-bold text-slate-700 mb-1">Password</label>
            <input
              id="admin-password"
              name="new-password"
              autoComplete="new-password"
              required
              type="password"
              minLength={12}
              maxLength={128}
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              disabled={loading}
              className="w-full border border-slate-200 p-3 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
              placeholder="At least 12 characters"
            />
            <p className="mt-1.5 text-xs text-slate-500">Use a long passphrase that is unique to this account. You must verify the admin email before signing in.</p>
          </div>
          <button
            disabled={loading}
            type="submit"
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all flex justify-center items-center gap-2 mt-4 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? <><Loader2 className="animate-spin" size={18} /> Creating workspace…</> : 'Create Workspace'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account? <Link href="/login" className="text-indigo-600 font-bold hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
