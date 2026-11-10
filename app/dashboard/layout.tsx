'use client';

import { Suspense, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Package, PlusCircle, LogOut, LayoutDashboard, Menu, X, Bell, BellRing, Users, WifiOff } from 'lucide-react';
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

  // --- LOUD BASE64 AUDIO ---
  const playNotificationSound = () => {
    const audio = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"+ "1234567890".repeat(20)); 
    audio.volume = 1.0;
    audio.play().catch((e) => console.log('Audio play blocked by browser:', e));
  };

  // --- NETWORK & VERSION POLLING ---
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      processQueue(); 
      toast.success("Connection restored. Syncing data...");
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error("You are offline. Changes will be saved locally.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let currentVersion = '';
    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version');
        const data = await res.json();
        if (!currentVersion) {
          currentVersion = data.version;
        } else if (currentVersion !== data.version) {
          toast.info("New Update Available", {
            description: "A new version has been deployed.",
            duration: Infinity,
            action: { label: 'Update Now', onClick: () => window.location.reload() }
          });
        }
      } catch (e) {}
    };

    checkVersion();
    const versionInterval = setInterval(checkVersion, 4 * 1000); // 4 seconds

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

        // ADD ROLE TAG VIA DEFERRED SCRIPT
        if (typeof window !== 'undefined') {
          (window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];
          (window as any).OneSignalDeferred.push(async function(OneSignal: any) {
            await OneSignal.User.addTag('role', role);
            if (Notification.permission === 'granted' || OneSignal.Notifications.permission) {
              setPushEnabled(true);
            }
          });
        }

        // Fetch initial notifications (Role-specific OR broadcast ALL)
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .or(`role_target.eq.${role},role_target.eq.ALL`)
          .order('created_at', { ascending: false })
          .limit(20);
        if (data) setNotifications(data);

        // Realtime Listener
        const channel = supabase
          .channel(`notification-changes-global`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications' },
            (payload) => {
              if (payload.new.role_target !== role && payload.new.role_target !== 'ALL') return;

              setNotifications((prev) => [payload.new, ...prev]);
              playNotificationSound();

              toast(payload.new.title, {
                description: payload.new.message,
                duration: 10000,
                action: {
                  label: 'View',
                  onClick: () => {
                    if (payload.new.shipment_awb) router.push(`/dashboard/shipments/${payload.new.shipment_awb}`);
                  }
                }
              });
            }
          ).subscribe();

        return () => { supabase.removeChannel(channel); };
      }
    };
    getUser();
  }, [router]);

  useEffect(() => { setIsSidebarOpen(false); }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  // REQUEST PERMISSION VIA DEFERRED SCRIPT
  const requestPushPermission = async () => {
    if (typeof window !== 'undefined') {
      (window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];
      (window as any).OneSignalDeferred.push(async function(OneSignal: any) {
        await OneSignal.Notifications.requestPermission();
        if (Notification.permission === 'granted') {
          setPushEnabled(true);
          toast.success('Push notifications enabled!');
        } else {
          toast.error('Notifications blocked. Enable in browser settings.');
        }
      });
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (typeof window !== 'undefined' && 'setAppBadge' in navigator) {
      if (unreadCount > 0) navigator.setAppBadge(unreadCount).catch(() => {});
      else navigator.clearAppBadge().catch(() => {});
    }
  }, [unreadCount]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Toaster position="top-right" richColors theme="light" closeButton />
      
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200/60 flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)]`}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/icon-192.png" alt="Logo" className="w-10 h-10 rounded-xl shadow-md object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Marchlog</h1>
              <p className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full inline-block mt-1">{userRole}</p>
            </div>
          </div>
          <button className="md:hidden text-slate-400" onClick={() => setIsSidebarOpen(false)}><X size={20} /></button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <Link href="/dashboard" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm ${pathname === '/dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}><LayoutDashboard size={18} /> Overview</Link>
          
          {(userRole === 'Customer Service' || userRole === 'Super Admin') && (
            <Link href="/dashboard/register" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm ${pathname === '/dashboard/register' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}><PlusCircle size={18} /> Register</Link>
          )}

          <Link href="/dashboard/shipments" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm ${pathname.includes('/dashboard/shipments') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}><Package size={18} /> Shipments</Link>

          {(userRole === 'Finance' || userRole === 'Super Admin') && (
            <Link href="/dashboard/clients" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm ${pathname.includes('/dashboard/clients') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}><Users size={18} /> Clients</Link>
          )}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button onClick={handleLogout} className="flex items-center justify-center gap-2 p-2.5 w-full text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl font-medium text-sm"><LogOut size={16} /> Sign out</button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/60 p-4 sticky top-0 z-30 flex items-center justify-between">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-slate-600 p-2"><Menu size={20} /></button>

          <div className="flex items-center gap-3 ml-auto">
            {!isOnline && <div className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1.5 rounded-xl text-sm font-semibold animate-pulse"><WifiOff size={16} /> Offline</div>}

            {!pushEnabled && isOnline && (
              <button onClick={requestPushPermission} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-md animate-bounce">
                <BellRing size={16} className="inline mr-1" /> Enable Alerts
              </button>
            )}

            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl relative border border-slate-200">
                <Bell size={20} />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">{unreadCount}</span>}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between"><h3 className="font-bold">Alerts</h3><button onClick={() => setShowNotifications(false)}><X size={16}/></button></div>
                  <div className="max-h-100 overflow-y-auto">
                    {notifications.map(n => (
                      <div key={n.id} onClick={() => { markAsRead(n.id); if (n.shipment_awb) router.push(`/dashboard/shipments/${n.shipment_awb}`); setShowNotifications(false); }} className={`p-4 border-b cursor-pointer hover:bg-slate-50 ${!n.is_read ? 'bg-indigo-50/50' : ''}`}>
                        <p className={`text-sm ${!n.is_read ? 'font-bold' : ''}`}>{n.title}</p>
                        <p className="text-xs text-slate-500">{n.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8"><div className="max-w-7xl mx-auto">{children}</div></main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="p-10 text-center">Loading...</div>}><DashboardContent>{children}</DashboardContent></Suspense>;
}