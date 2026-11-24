'use client';

import { RouteError } from '@/components/route-error';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError title="Your workspace couldn't load" description="We couldn't complete this request. Your data has not been changed. Try again, or return to the workspace overview." reset={reset} error={error} />;
}
