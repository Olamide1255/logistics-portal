import type { Instrumentation } from 'next';
import { captureSentryException } from './lib/sentry';
import { capturePostHogLog } from './lib/posthog-logs';

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const route = context.routePath || 'unknown';
  const source = `next-${context.routeType}`;

  await Promise.allSettled([
    captureSentryException(error, {
      route,
      method: request.method,
      source,
    }),
    capturePostHogLog({
      message: 'Next.js request error',
      severityNumber: 17,
      severityText: 'ERROR',
      attributes: {
        route,
        method: request.method,
        source,
      },
    }),
  ]);
};
