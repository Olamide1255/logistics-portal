'use client';

import { RouteError } from '@/components/route-error';

export default function PlatformError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError title="Platform console unavailable" description="The platform workspace encountered an unexpected issue. No tenant changes were applied by this failed request. Try again to restore the console." reset={reset} />;
}
