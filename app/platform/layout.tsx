'use client';
import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LayoutDashboard, LogOut, Menu, ShieldCheck, Loader2, X, Building2, PlusCircle } from 'lucide-react';
import { toast, Toaster } from 'sonner';
export default function PlatformLayout({ children }: { children: ReactNode }) {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [email, setEmail] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter(); const pathname = usePathname();
  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) { router.replace('/login'); return; }
        const { data: profile, error } = await supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single();
        if (error) throw error;
        if (!active) return;
        if (!profile?.is_platform_admin) { router.replace('/dashboard'); return; }
        setEmail(user.email || '');
        setCheckingAccess(false);
      } catch {
        if (active) router.replace('/login');
      }
    };
    void verify();
    return () => { active = false; };
  }, [router]);
  useEffect(() => { setMobileNavOpen(false); document.title = pathname === '/platform' ? 'SaaS Dashboard | LogiFlow' : 'Platform Console | LogiFlow'; }, [pathname]);
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // A hard navigation guarantees the authenticated App Router tree is discarded.
      window.location.replace('/login');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign out. Please try again.');
      setSigningOut(false);
    }
  };
  const navLink = (href: string, label: string, icon: ReactNode) => {
    const section = href.includes('#');
    const target = section ? href.slice(href.indexOf('#')) : href;
    const className = `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${!section && pathname === href ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`;
    const onClick = () => setMobileNavOpen(false);
    return section
      ? <a href={target} onClick={onClick} className={className}>{icon}{label}</a>
      : <Link href={target} onClick={onClick} className={className}>{icon}{label}</Link>;
  };
  if (checkingAccess) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-10 py-9 shadow-sm"><Loader2 className="animate-spin text-indigo-600" size={30} /><p className="text-sm font-semibold text-slate-700">Verifying platform access…</p><p className="text-xs text-slate-400">Preparing your administration workspace</p></div></div>;
  return <div className="flex min-h-screen bg-slate-50 text-slate-900"><Toaster position="top-right" richColors closeButton />
    <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"><ShieldCheck size={22} /></div><div><p className="text-base font-extrabold tracking-tight">LogiFlow</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-600">Platform Console</p></div></div>
      <div className="px-4 py-6"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p>{navLink('/platform', 'Overview', <LayoutDashboard size={18} />)}{navLink('/platform#tenant-companies', 'Tenant companies', <Building2 size={18} />)}{navLink('/platform#onboard-company', 'Onboard company', <PlusCircle size={18} />)}</div>
      <div className="mt-auto border-t border-slate-100 p-4"><div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700"><ShieldCheck size={17} /></div><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">Platform Admin</p><p className="truncate text-[11px] text-slate-500">{email}</p></div></div><button onClick={signOut} disabled={signingOut} className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60">{signingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}{signingOut ? 'Signing out…' : 'Sign out'}</button></div>
    </aside>
    {mobileNavOpen && <button aria-label="Close navigation overlay" onClick={() => setMobileNavOpen(false)} className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden" />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform lg:hidden ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-20 items-center justify-between border-b border-slate-100 px-6"><div className="flex items-center gap-3"><ShieldCheck className="text-indigo-600" /><span className="font-extrabold">LogiFlow Console</span></div><button aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19} /></button></div>
      <nav className="space-y-1 p-4">{navLink('/platform', 'Overview', <LayoutDashboard size={18} />)}{navLink('/platform#tenant-companies', 'Tenant companies', <Building2 size={18} />)}{navLink('/platform#onboard-company', 'Onboard company', <PlusCircle size={18} />)}</nav><div className="mt-auto border-t border-slate-100 p-4"><p className="mb-3 truncate text-xs text-slate-500">{email}</p><button onClick={signOut} disabled={signingOut} aria-busy={signingOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-60">{signingOut ? <Loader2 size={17} className="animate-spin" /> : <LogOut size={17} />}{signingOut ? 'Signing out…' : 'Sign out'}</button></div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col"><header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-8"><div className="flex items-center gap-3"><button aria-label="Open navigation" onClick={() => setMobileNavOpen(true)} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"><Menu size={19} /></button><div><p className="text-sm font-bold text-slate-900">Platform administration</p><p className="text-xs text-slate-500">Global workspace · All tenants</p></div></div><div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Platform access active</div></header><main className="w-full flex-1 p-4 sm:p-7 lg:p-9"><div className="mx-auto w-full max-w-7xl">{children}</div></main></div>
  </div>;
}