'use client';

import OneSignal from 'react-onesignal';
import { Suspense, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Package, PlusCircle, LogOut, LayoutDashboard, Menu, X, Bell, BellRing, Users } from 'lucide-react';
import { Toaster, toast } from 'sonner';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [userRole, setUserRole] = useState<string>('Loading...');
  const [email, setEmail] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false); 
  
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
        let role = 'Unknown';
        if (prefix?.includes('admin') || prefix?.includes('it')) role = 'Super Admin';
        else if (prefix?.includes('finance')) role = 'Finance';
        else if (prefix?.includes('cs')) role = 'Customer Service';
        else if (prefix?.includes('rfs')) role = 'RFS';
        else if (prefix?.includes('ops')) role = 'Operations';
        setUserRole(role);

        if (typeof window !== 'undefined') {
          OneSignal.init({
            appId: '3bb74c5f-1956-404a-b6c9-7e84c7b070d8',
          }).then(() => {
            OneSignal.User.addTag('role', role);
            if (OneSignal.Notifications.permission) {
              setPushEnabled(true);
            }
          }).catch((err) => console.error("OneSignal Error:", err));
        }

        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('role_target', role)
          .order('created_at', { ascending: false })
          .limit(20);
        if (data) setNotifications(data);

        const channel = supabase
          .channel('schema-db-changes')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `role_target=eq.${role}` },
            (payload) => {
              setNotifications((prev) => [payload.new, ...prev]);
              toast(payload.new.title, {
                description: payload.new.message,
                action: {
                  label: 'View',
                  onClick: () => {
                    if (payload.new.shipment_awb) router.push(`/dashboard/shipments/${payload.new.shipment_awb}`);
                  }
                }
              });
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    };
    getUser();
  }, [router]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const requestPushPermission = async () => {
    await OneSignal.Notifications.requestPermission();
    if (OneSignal.Notifications.permission) {
      setPushEnabled(true);
      toast.success('Push notifications enabled!');
    } else {
      toast.error('Push notifications were blocked. Please check browser settings.');
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Toaster position="top-right" richColors />
      
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-blue-600">Logistics Portal</h1>
            <p className="text-sm text-gray-500 mt-1 font-semibold">{userRole}</p>
            <p className="text-xs text-gray-400 truncate">{email}</p>
          </div>
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

          {/* NEW FINANCE REPORTS LINK */}
          {(userRole === 'Finance' || userRole === 'Super Admin') && (
            <Link href="/dashboard/clients" className={`flex items-center gap-3 p-3 rounded transition ${pathname.includes('/dashboard/clients') ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Users size={20} /> Client Reports
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button onClick={handleLogout} className="flex items-center gap-3 p-3 w-full text-red-600 hover:bg-red-50 rounded transition">
            <LogOut size={20} /> Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-gray-600">
              <Menu size={24} />
            </button>
            <h1 className="text-lg font-bold text-gray-800 hidden md:block">Dashboard</h1>
          </div>

          <div className="flex items-center gap-4">
            {!pushEnabled && (
              <button 
                onClick={requestPushPermission}
                className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium hover:bg-blue-200 transition animate-pulse"
              >
                <BellRing size={16} /> Enable Alerts
              </button>
            )}

            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative">
                <Bell size={24} />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">Notifications</h3>
                    <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 && <p className="p-4 text-center text-gray-500 text-sm">No notifications.</p>}
                    {notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => {
                          markAsRead(n.id);
                          if (n.shipment_awb) router.push(`/dashboard/shipments/${n.shipment_awb}`);
                          setShowNotifications(false);
                        }}
                        className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition ${!n.is_read ? 'bg-blue-50' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <p className={`text-sm ${!n.is_read ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{n.title}</p>
                          <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-gray-500">{n.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
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