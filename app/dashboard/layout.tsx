'use client';

import OneSignal from 'react-onesignal';
import { Suspense, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Package, PlusCircle, LogOut, LayoutDashboard, Menu, X, Bell, BellRing, Users, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { processQueue } from '@/lib/offlineSync';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [userRole, setUserRole] = useState<string>('Loading...');
  const [email, setEmail] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });
  
  const router = useRouter();
  const pathname = usePathname(); 

  // --- SOUND ALERT FUNCTION ---
  const playNotificationSound = () => {
    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    audio.play().catch((e) => console.log('Audio play blocked by browser:', e));
  };

  // --- NETWORK & VERSION POLLING ---
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      processQueue(); // Sync offline data when connection returns
      toast.success("Connection restored. Syncing data...");
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error("You are offline. Changes will be saved locally.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for app updates every 5 minutes
    let currentVersion = '';
    
    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version');
        const data = await res.json();
        
        if (!currentVersion) {
          currentVersion = data.version;
        } else if (currentVersion !== data.version) {
          // New version detected!
          toast.info("New Update Available", {
            description: "A new version of the portal has been deployed.",
            duration: Infinity,
            action: {
              label: 'Update Now',
              onClick: () => window.location.reload()
            }
          });
        }
      } catch (e) {
        // Ignore fetch errors (user might be offline)
      }
    };

    checkVersion();
    const versionInterval = setInterval(checkVersion, 1 * 60 * 1000); // 1 minute
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(versionInterval);
    };
  }, []);

  // --- AUTH & REALTIME NOTIFICATIONS ---
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
        else if (prefix?.includes('cs') || prefix?.includes('info')) role = 'Customer Service'; 
        else if (prefix?.includes('rfs')) role = 'RFS';
        else if (prefix?.includes('ops')) role = 'Operations';
        setUserRole(role);

        if (typeof window !== 'undefined') {
          OneSignal.init({
            appId: '3bb74c5f-1956-404a-b6c9-7e84c7b070d8',
          }).then(() => {
            OneSignal.User.addTag('role', role);
            if (Notification.permission === 'granted' || OneSignal.Notifications.permission) {
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

        // Updated Realtime Listener to fix missed notifications
        const channel = supabase
          .channel(`notification-changes-${role}`) // Unique channel name
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications' }, // Removed server filter to ensure no drops
            (payload) => {
              // Filter in JS to ensure it's for the right role
              if (payload.new.role_target !== role) return;

              setNotifications((prev) => [payload.new, ...prev]);
              
              // PLAY SOUND
              playNotificationSound();

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
    try {
      await OneSignal.Notifications.requestPermission();
      if (Notification.permission === 'granted') {
        setPushEnabled(true);
        toast.success('Push notifications enabled!');
      } else {
        toast.error('Notifications were blocked. Please enable them in your browser settings.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

   // --- APP ICON BADGE UPDATE ---
  useEffect(() => {
    if (typeof window !== 'undefined' && 'setAppBadge' in navigator) {
      if (unreadCount > 0) {
        navigator.setAppBadge(unreadCount).catch((e) => console.log('Badge error', e));
      } else {
        navigator.clearAppBadge().catch((e) => console.log('Badge error', e));
      }
    }
  }, [unreadCount]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Toaster position="top-right" richColors theme="light" />
      
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden transition-opacity" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* PREMIUM SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200/60 flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)]`}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-md shadow-indigo-600/20">
              <Package size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Logistics Portal</h1>
              <p className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full inline-block mt-1">{userRole}</p>
            </div>
          </div>
          <button className="md:hidden text-slate-400 hover:text-slate-600" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-4">Main Menu</p>
          
          <Link href="/dashboard" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${pathname === '/dashboard' ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-500/10' : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'}`}>
            <LayoutDashboard size={18} className={pathname === '/dashboard' ? 'text-indigo-600' : 'text-slate-400'} /> Overview
          </Link>
          
          {(userRole === 'Customer Service' || userRole === 'Super Admin') && (
            <Link href="/dashboard/register" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${pathname === '/dashboard/register' ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-500/10' : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'}`}>
              <PlusCircle size={18} className={pathname === '/dashboard/register' ? 'text-indigo-600' : 'text-slate-400'} /> Register Shipment
            </Link>
          )}

          <Link href="/dashboard/shipments" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${pathname.includes('/dashboard/shipments') ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-500/10' : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'}`}>
            <Package size={18} className={pathname.includes('/dashboard/shipments') ? 'text-indigo-600' : 'text-slate-400'} /> All Shipments
          </Link>

          {(userRole === 'Finance' || userRole === 'Super Admin') && (
            <>
              <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-6">Finance</p>
              <Link href="/dashboard/clients" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${pathname.includes('/dashboard/clients') ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-500/10' : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'}`}>
                <Users size={18} className={pathname.includes('/dashboard/clients') ? 'text-indigo-600' : 'text-slate-400'} /> Client Reports
              </Link>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-xl mb-2 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
              {email.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-900 truncate">{email.split('@')[0]}</p>
              <p className="text-[10px] text-slate-500 truncate">{email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center justify-center gap-2 p-2.5 w-full text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 font-medium text-sm">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* GLASSMORPHISM HEADER */}
        <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/60 p-4 sticky top-0 z-30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-slate-600 p-2 hover:bg-slate-100 rounded-lg">
              <Menu size={20} />
            </button>
            <h1 className="text-sm font-semibold text-slate-500 uppercase tracking-widest hidden md:block">Workspace</h1>
          </div>

          <div className="flex items-center gap-3">
            
            {/* OFFLINE INDICATOR */}
            {!isOnline && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1.5 rounded-xl text-sm font-semibold border border-red-200 animate-pulse">
                <WifiOff size={16} /> Offline Mode
              </div>
            )}

            {!pushEnabled && isOnline && (
              <button 
                onClick={requestPushPermission}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition-all duration-200"
              >
                <BellRing size={16} /> Enable Alerts
              </button>
            )}

            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl relative transition-colors border border-transparent hover:border-slate-200">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 z-50 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Notifications</h3>
                    <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
                  </div>
                  <div className="max-h-100 overflow-y-auto">
                    {notifications.length === 0 && <p className="p-6 text-center text-slate-500 text-sm">You're all caught up!</p>}
                    {notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => {
                          markAsRead(n.id);
                          if (n.shipment_awb) router.push(`/dashboard/shipments/${n.shipment_awb}`);
                          setShowNotifications(false);
                        }}
                        className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${!n.is_read ? 'bg-indigo-50/50' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <p className={`text-sm ${!n.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{n.title}</p>
                          <span className="text-[10px] font-medium text-slate-400 uppercase">{new Date(n.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{n.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}>
      <DashboardContent>{children}</DashboardContent>
    </Suspense>
  );
}