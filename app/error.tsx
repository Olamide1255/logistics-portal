'use client';

import { RouteError } from '@/components/route-error';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError title="This page couldn't load" description="An unexpected issue interrupted this page. Your data has not been changed by this failed request. Try again or return to the home page." reset={reset} error={error} />;
}
