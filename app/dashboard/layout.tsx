'use client';

import { Suspense, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Package, PlusCircle, LogOut, LayoutDashboard, Menu, X } from 'lucide-react';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [userRole, setUserRole] = useState<string>('Loading...');
  const [email, setEmail] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // State for mobile sidebar
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
        if (prefix?.includes('admin') || prefix?.includes('it')) setUserRole('Super Admin');
        else if (prefix?.includes('finance')) setUserRole('Finance');
        else if (prefix?.includes('cs')) setUserRole('Customer Service');
        else if (prefix?.includes('rfs')) setUserRole('RFS');
        else if (prefix?.includes('ops')) setUserRole('Operations');
        else setUserRole('Unknown');
      }
    };
    getUser();
  }, [router]);

  // Close sidebar when a link is clicked on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      
      {/* MOBILE OVERLAY BACKDROP */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-blue-600">Logistics Portal</h1>
            <p className="text-sm text-gray-500 mt-1 font-semibold">{userRole}</p>
            <p className="text-xs text-gray-400 truncate">{email}</p>
          </div>
          {/* Close button for mobile */}
          <button className="md:hidden text-gray-500" onClick={() => setIsSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link href="/dashboard" className={`flex items-center gap-3 p-3 rounded transition ${pathname === '/dashboard' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
            <LayoutDashboard size={20} /> Overview
          </Link>
          
          {(userRole === 'Customer Service' || userRole === 'Super Admin') && (
            <Link href="/dashboard/register" className={`flex items-center gap-3 p-3 rounded transition ${pathname === '/dashboard/register' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
              <PlusCircle size={20} /> Register Shipment
            </Link>
          )}

          <Link href="/dashboard/shipments" className={`flex items-center gap-3 p-3 rounded transition ${pathname.includes('/dashboard/shipments') ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
            <Package size={20} /> All Shipments
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button onClick={handleLogout} className="flex items-center gap-3 p-3 w-full text-red-600 hover:bg-red-50 rounded transition">
            <LogOut size={20} /> Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* TOP MOBILE HEADER */}
        <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-blue-600">Logistics Portal</h1>
          <button onClick={() => setIsSidebarOpen(true)} className="text-gray-600">
            <Menu size={24} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>

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