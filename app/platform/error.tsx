'use client';

import { RouteError } from '@/components/route-error';

export default function PlatformError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError title="Platform console unavailable" description="The platform workspace encountered an unexpected issue. Try again, or return to the platform overview." reset={reset} backHref="/platform" backLabel="Return to platform" />;
}
