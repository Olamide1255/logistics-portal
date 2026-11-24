'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

type Consent = 'accepted' | 'rejected' | null;
type PostHogClient = {
  capture?: (event: string, properties?: Record<string, unknown>) => void;
  opt_out_capturing?: () => void;
  opt_in_capturing?: () => void;
};
declare global {
  interface Window {
    posthog?: PostHogClient;
    __logiflowPostHogBootstrapped?: boolean;
  }
}

const CONSENT_KEY = 'logiflow-cookie-consent';

function safeAnalyticsPath(pathname: string) {
  if (pathname.startsWith('/track/')) return '/track/[token]';
  if (/^\/dashboard\/shipments\/[^/]+/.test(pathname)) return '/dashboard/shipments/[awb]';
  return pathname || '/';
}

function postHogBootstrap(key: string, host: string) {
  return `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once people.unset people.increment people.append people.remove people.group set_group reset register register_once unregister opt_in_capturing opt_out_capturing has_opted_out_capturing get_distinct_id get_session_id get_session_replay_url isFeatureEnabled getFeatureFlag getFeatureFlagPayload reloadFeatureFlags onFeatureFlags group".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
window.posthog.init(${JSON.stringify(key)}, { api_host: ${JSON.stringify(host)}, autocapture: false, capture_pageview: false, disable_session_recording: true, person_profiles: 'identified_only' });`;
}

export function AnalyticsConsent() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(CONSENT_KEY);
    if (saved === 'accepted' || saved === 'rejected') {
      setConsent(saved);
      setShowBanner(false);
    } else {
      setShowBanner(true);
    }
    const openSettings = () => { setShowBanner(true); setSettingsOpen(true); };
    window.addEventListener('logiflow:cookie-settings', openSettings);
    return () => window.removeEventListener('logiflow:cookie-settings', openSettings);
  }, []);

  useEffect(() => {
    if (consent !== 'accepted') return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
    if (!window.__logiflowPostHogBootstrapped) {
      const script = document.createElement('script');
      script.id = 'logiflow-posthog';
      script.text = postHogBootstrap(key, host);
      document.head.appendChild(script);
      window.__logiflowPostHogBootstrapped = true;
    }
    const safePath = safeAnalyticsPath(pathname);
    window.posthog?.capture?.('$pageview', { $current_url: window.location.origin + safePath, page_path: safePath });
  }, [consent, pathname]);

  const choose = (value: Exclude<Consent, null>) => {
    window.localStorage.setItem(CONSENT_KEY, value);
    setConsent(value);
    setShowBanner(false);
    setSettingsOpen(false);
    if (value === 'rejected') window.posthog?.opt_out_capturing?.();
    if (value === 'accepted') window.posthog?.opt_in_capturing?.();
  };

  return (
    <>
      {showBanner ? (
        <section aria-label="Cookie preferences" aria-live="polite" className="fixed inset-x-3 bottom-24 z-[70] mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-950/20 sm:inset-x-6 sm:bottom-6 sm:flex sm:items-center sm:gap-5 sm:p-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900">{settingsOpen ? 'Privacy preferences' : 'Your privacy matters'}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">Essential storage keeps LogiFlow secure and working. Optional analytics help us improve the product and are off unless you agree. We do not use session replay.</p>
            <Link href="/privacy" className="mt-1 inline-block text-xs font-semibold text-indigo-600 underline underline-offset-2">Read our privacy policy</Link>
          </div>
          <div className="mt-3 flex shrink-0 flex-wrap gap-2 sm:mt-0">
            <button type="button" onClick={() => choose('rejected')} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Reject optional</button>
            <button type="button" onClick={() => choose('accepted')} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">Accept analytics</button>
          </div>
        </section>
      ) : (
        <button type="button" onClick={() => { setShowBanner(true); setSettingsOpen(true); }} className="fixed bottom-3 left-3 z-[60] rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-md backdrop-blur hover:bg-slate-50">Privacy settings</button>
      )}
    </>
  );
}
