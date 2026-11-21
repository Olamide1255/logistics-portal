'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Package, PlusCircle, LogOut, LayoutDashboard, Menu, X, Bell, BellRing, Users, WifiOff, Plane, Settings, ShieldCheck, Loader2, BarChart3 } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { processQueue } from '@/lib/offlineSync';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [userRole, setUserRole] = useState<string>('Loading...');
  const [email, setEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [companyInfo, setCompanyInfo] = useState({ name: 'LogiFlow', logo_url: '/icon-192.png' });
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false); 
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  
  // User Preferences
  const [userPreferences, setUserPreferences] = useState({ sound_alerts: true, push_notifications: true });
  // Use a ref to avoid re-subscribing to realtime when preferences change
  const preferencesRef = useRef(userPreferences);
  useEffect(() => { preferencesRef.current = userPreferences; }, [userPreferences]);
  
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });
  
  const router = useRouter();
  const pathname = usePathname(); 

  const playNotificationSound = () => {
    if (!preferencesRef.current.sound_alerts || typeof window === 'undefined') return;

    const AudioContextConstructor = window.AudioContext
      || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;

    try {
      const context = new AudioContextConstructor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.17);
      oscillator.onended = () => { void context.close(); };
    } catch {
      // Browsers may block audio until the user interacts with the page.
    }
  };

  const fetchNotifications = async (role: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .or(`role_target.eq.${role},role_target.eq.ALL`)
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setNotifications(data);
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      
      setEmail(user.email || '');
      setUserId(user.id);
      
      // 1. Fetch Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, company_id, is_platform_admin, sound_alerts, push_notifications')
        .eq('id', user.id)
        .single();
      
      let role = profile?.role || 'Unknown';
      setUserRole(role);
      setIsPlatformAdmin(profile?.is_platform_admin || false);
      setUserPreferences({
        sound_alerts: profile?.sound_alerts !== false,
        push_notifications: profile?.push_notifications !== false
      });

      // 2. Check tenant status through a narrowly scoped RPC.
      // Suspended tenants are intentionally blocked from selecting their company row by RLS,
      // so the status must be fetched through the self-only status function.
      if (profile?.company_id) {
        const { data: companyStatus, error: companyStatusError } = await supabase.rpc('get_my_company_status');

        if (companyStatusError) {
          console.error('Unable to verify company access status:', companyStatusError);
        }

        if (companyStatus === 'Suspended' && !profile.is_platform_admin) {
          await supabase.auth.signOut();
          alert("Your company account has been suspended. Please contact support.");
          window.location.replace('/login');
          return;
        }

        // 3. Fetch Company
        const { data: comp } = await supabase
          .from('companies')
          .select('name, logo_url, status')
          .eq('id', profile.company_id)
          .single();

        if (comp) {
          // Retain this check as a fallback if company-row visibility changes later.
          if (comp.status === 'Suspended' && !profile.is_platform_admin) {
            await supabase.auth.signOut();
            alert("Your company account has been suspended. Please contact support.");
            window.location.replace('/login');
            return;
          }

          let displayLogo = '/icon-192.png';
          if (comp.logo_url) {
            if (comp.logo_url.startsWith('http')) {
              displayLogo = comp.logo_url;
            } else {
              const { data: signedData } = await supabase.storage.from('shipment-documents').createSignedUrl(comp.logo_url, 3600);
              if (signedData?.signedUrl) displayLogo = signedData.signedUrl;
            }
          }

          setCompanyInfo({ 
            name: comp.name || 'LogiFlow', 
            logo_url: displayLogo 
          });
        }
      }

      // 3. OneSignal Tagging
      if (typeof window !== 'undefined') {
        (window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];
        (window as any).OneSignalDeferred.push(async function(OneSignal: any) {
          await OneSignal.User.addTag('role', role);
          if (profile?.company_id) {
            await OneSignal.User.addTag('company_id', profile.company_id);
          }
          if (Notification.permission === 'granted' || OneSignal.Notifications.permission) setPushEnabled(true);
        });
      }
      
      await fetchNotifications(role);
    };
    getUser();
  }, [router]);

  useEffect(() => {
    if (userRole === 'Loading...' || !userId) return;

    const channel = supabase
      .channel(`notif-changes-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.new.role_target !== userRole && payload.new.role_target !== 'ALL') return;
        
        setNotifications((prev) => prev.some(n => n.id === payload.new.id) ? prev : [payload.new, ...prev]);
        
        // Respect User Preferences
        if (preferencesRef.current.sound_alerts) playNotificationSound();
        
        if (preferencesRef.current.push_notifications) {
          toast(payload.new.title, { 
            description: payload.new.message, 
            duration: 10000, 
            action: { 
              label: 'View', 
              onClick: () => { 
                if (payload.new.shipment_awb && payload.new.shipment_awb !== 'null') {
                  router.push(`/dashboard/shipments/${encodeURIComponent(payload.new.shipment_awb.trim())}`); 
                } 
              } 
            } 
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userRole, userId, router]);

  useEffect(() => {
    if (userRole === 'Loading...') return;
    const pollNotifications = () => {
      if (navigator.onLine && document.visibilityState === 'visible') void fetchNotifications(userRole);
    };
    const interval = setInterval(pollNotifications, 2 * 60 * 1000);
    document.addEventListener('visibilitychange', pollNotifications);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', pollNotifications);
    };
  }, [userRole]);

  useEffect(() => {
    let currentVersion = '';
    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version');
        const data = await res.json();
        if (!currentVersion) currentVersion = data.version;
        else if (currentVersion !== data.version) {
          toast.info("New Update Available", { description: "Please refresh.", duration: Infinity, action: { label: 'Update', onClick: () => window.location.reload() } });
        }
      } catch (e) {}
    };
    checkVersion();
    const pollVersion = () => {
      if (document.visibilityState === 'visible') void checkVersion();
    };
    const interval = setInterval(pollVersion, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', pollVersion);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', pollVersion);
    };
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      void processQueue().then((result) => {
        if (result.processed > 0) toast.success(`${result.processed} offline comment${result.processed === 1 ? '' : 's'} synced.`);
        else toast.success('Connection restored.');
        if (result.pending > 0) toast.warning(`${result.pending} offline comment${result.pending === 1 ? '' : 's'} still need syncing.`);
        if (result.discarded > 0) toast.error(`${result.discarded} invalid offline item${result.discarded === 1 ? '' : 's'} were discarded.`);
      }).catch(() => toast.error('Connection restored, but offline comments could not be synced.'));
    };
    const handleOffline = () => { setIsOnline(false); toast.error("You are offline."); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => { setIsSidebarOpen(false); }, [pathname]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.replace('/login');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign out. Please try again.');
      setIsLoggingOut(false);
    }
  };
  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      console.error('Notification acknowledgement failed:', error);
      toast.error('Unable to mark this notification as read. Please try again.');
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, is_read: true } : notification
      )
    );
  };
  
  const requestPushPermission = async () => {
    if (typeof window !== 'undefined') {
      (window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];
      (window as any).OneSignalDeferred.push(async function(OneSignal: any) {
        await OneSignal.Notifications.requestPermission();
        if (Notification.permission === 'granted') { setPushEnabled(true); toast.success('Push enabled!'); }
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
      
      {isSidebarOpen && <button type="button" aria-label="Close navigation menu" className="fixed inset-0 z-40 bg-slate-950/30 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside id="dashboard-sidebar" aria-label="Workspace navigation" className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200/60 flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)]`}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={companyInfo.logo_url} alt="Logo" className="w-10 h-10 rounded-xl shadow-md object-contain bg-white" onError={(e) => { e.currentTarget.src = '/icon-192.png'; }} />
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight truncate max-w-37.5">{companyInfo.name}</h1>
              <div className="flex items-center gap-1 mt-1">
                <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full inline-block uppercase tracking-wider">{userRole}</p>
                {isPlatformAdmin && <ShieldCheck size={14} className="text-emerald-500" />}
              </div>
            </div>
          </div>
          <button type="button" aria-label="Close navigation menu" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 md:hidden" onClick={() => setIsSidebarOpen(false)}><X size={20} /></button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <Link href="/dashboard" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm ${pathname === '/dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}><LayoutDashboard size={18} /> Overview</Link>
          
          {/* HIDE TENANT MENUS FOR PLATFORM ADMIN */}
          {!isPlatformAdmin && (
            <>
              {(userRole === 'Customer Service' || userRole === 'Super Admin' || userRole === 'Freight') && (
                <Link href="/dashboard/register" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm ${pathname === '/dashboard/register' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}><PlusCircle size={18} /> Register</Link>
              )}
              
              <Link href="/dashboard/shipments" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm ${pathname.includes('/dashboard/shipments') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}><Package size={18} /> Shipments</Link>
              
              {(userRole === 'Finance' || userRole === 'Super Admin') && (
                <Link href="/dashboard/reports" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm ${pathname.includes('/dashboard/reports') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}><BarChart3 size={18} /> Reports</Link>
              )}

              {(userRole === 'Finance' || userRole === 'Super Admin') && (
                <Link href="/dashboard/clients" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm ${pathname.includes('/dashboard/clients') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}><Users size={18} /> Clients</Link>
              )}

              {(userRole === 'Super Admin' || isPlatformAdmin) && (
                <>
                  <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-6">Company Admin</p>
                  <Link href="/dashboard/employees" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm ${pathname.includes('/dashboard/employees') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}><Users size={18} /> Employees</Link>
                  <Link href="/dashboard/settings" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm ${pathname.includes('/dashboard/settings') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}><Settings size={18} /> Company Settings</Link>
                  <Link href="/dashboard/audit-logs" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm ${pathname.includes('/dashboard/audit-logs') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}><ShieldCheck size={18} /> Audit Logs</Link>
                </>
              )}
            </>
          )}

          {/* PLATFORM ADMIN MENU */}
          {isPlatformAdmin && (
            <>
              <p className="px-3 text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 mt-6">Platform Admin</p>
              <Link href="/platform" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm ${pathname.includes('/platform') ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`}><ShieldCheck size={18} /> SaaS Dashboard</Link>
            </>
          )}
        </nav>
        
        <div className="p-4 border-t border-slate-100">
          <button type="button" onClick={handleLogout} disabled={isLoggingOut} aria-busy={isLoggingOut} className="flex items-center justify-center gap-2 p-2.5 w-full text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl font-medium text-sm disabled:cursor-wait disabled:opacity-60">{isLoggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}{isLoggingOut ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/60 p-4 sticky top-0 z-30 flex items-center justify-between">
          <button type="button" aria-label="Open navigation menu" aria-expanded={isSidebarOpen} aria-controls="dashboard-sidebar" onClick={() => setIsSidebarOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"><Menu size={20} /></button>
          <div className="flex items-center gap-3 ml-auto">
            {!isOnline && <div className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1.5 rounded-xl text-sm font-semibold animate-pulse"><WifiOff size={16} /> Offline</div>}
            {!pushEnabled && isOnline && (<button type="button" onClick={requestPushPermission} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-md animate-bounce"><BellRing size={16} className="inline mr-1" /> Enable Alerts</button>)}
            <div className="relative">
              <button type="button" aria-label="Toggle notifications" aria-expanded={showNotifications} aria-controls="notification-panel" onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl relative border border-slate-200">
                <Bell size={20} />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">{unreadCount}</span>}
              </button>
              {showNotifications && (
                <div id="notification-panel" role="region" aria-label="Notifications" className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center"><h3 className="font-bold">Alerts</h3><button type="button" aria-label="Close notifications" onClick={() => setShowNotifications(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200"><X size={16}/></button></div>
                  <div className="max-h-100 overflow-y-auto">
                    {notifications.length === 0 && <p className="p-4 text-center text-slate-500 text-sm">No notifications.</p>}
                    {notifications.map(n => (
                      <button type="button" key={n.id} onClick={() => { 
                        markAsRead(n.id); 
                        if (n.shipment_awb && n.shipment_awb !== 'null') {
                          router.push(`/dashboard/shipments/${encodeURIComponent(n.shipment_awb.trim())}`); 
                        }
                        setShowNotifications(false); 
                      }} className={`p-4 border-b cursor-pointer hover:bg-slate-50 ${!n.is_read ? 'bg-indigo-50/50' : ''}`}>
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