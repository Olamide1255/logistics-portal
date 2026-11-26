'use client';

import { RouteError } from '@/components/route-error';

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError title="This page couldn't load" description="An unexpected issue interrupted this page. Please try again, or return to the LogiFlow homepage." reset={reset} backHref="/" backLabel="Return home" />;
}
