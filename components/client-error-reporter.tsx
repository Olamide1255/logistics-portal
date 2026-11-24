'use client';

import { useEffect } from 'react';

export function ClientErrorReporter() {
  useEffect(() => {
    const report = (message: string, stack?: string) => {
      const clean = (value: string) => value
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
        .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '[id]')
        .slice(0, 2500);
      const currentPath = window.location.pathname;
      const safePath = currentPath.startsWith('/track/')
        ? '/track/[token]'
        : currentPath.startsWith('/dashboard/shipments/')
          ? '/dashboard/shipments/[awb]'
          : currentPath;
      void fetch('/api/monitoring/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clean(message), stack: clean(stack || ''), path: safePath }),
        keepalive: true,
      }).catch(() => {});
    };
    const onError = (event: ErrorEvent) => report(event.message || 'Unhandled browser error', event.error?.stack);
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      report(reason instanceof Error ? reason.message : 'Unhandled promise rejection', reason instanceof Error ? reason.stack : String(reason));
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
