'use client';

import { RouteError } from '@/components/route-error';

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError title="Your workspace couldn't load" description="We couldn't complete this request. Try again, or return to the workspace overview." reset={reset} />;
}
