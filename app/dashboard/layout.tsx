'use client';

import { Suspense, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Package, PlusCircle, LogOut, LayoutDashboard } from 'lucide-react';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [userRole, setUserRole] = useState<string>('Loading...');
  const [email, setEmail] = useState<string>('');
  const router = useRouter();
  const pathname = usePathname(); 

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        setEmail(user.email || '');
        const prefix = user.email?.split('@')[0].toLowerCase();
        if (prefix?.includes('admin')) setUserRole('Super Admin');
        else if (prefix?.includes('finance')) setUserRole('Finance');
        else if (prefix?.includes('cs')) setUserRole('Customer Service');
        else if (prefix?.includes('rfs')) setUserRole('RFS');
        else if (prefix?.includes('ops')) setUserRole('Operations');
        else setUserRole('Unknown');
      }
    };
    getUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-600">Logistics Portal</h1>
          <p className="text-sm text-gray-500 mt-1">{userRole}</p>
          <p className="text-xs text-gray-400 truncate">{email}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/dashboard" className={`flex items-center gap-3 p-3 rounded ${pathname === '/dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}>
            <LayoutDashboard size={20} /> Dashboard
          </Link>
          
          {(userRole === 'Customer Service' || userRole === 'Super Admin') && (
            <Link href="/dashboard/register" className={`flex items-center gap-3 p-3 rounded ${pathname === '/dashboard/register' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}>
              <PlusCircle size={20} /> Register Shipment
            </Link>
          )}

          <Link href="/dashboard/shipments" className={`flex items-center gap-3 p-3 rounded ${pathname === '/dashboard/shipments' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}>
            <Package size={20} /> All Shipments
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button onClick={handleLogout} className="flex items-center gap-3 p-3 w-full text-red-600 hover:bg-red-50 rounded">
            <LogOut size={20} /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading Dashboard...</div>}>
      <DashboardContent>{children}</DashboardContent>
    </Suspense>
  );
}