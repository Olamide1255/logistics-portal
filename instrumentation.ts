import type { Instrumentation } from 'next';
import { capturePostHogLog } from './lib/posthog-logs';

export const onRequestError: Instrumentation.onRequestError = async (_error, request, context) => {
  await capturePostHogLog({
    message: 'Next.js request error',
    severityNumber: 17,
    severityText: 'ERROR',
    attributes: {
      route: context.routePath || 'unknown',
      method: request.method,
      source: `next-${context.routeType}`,
    },
  });
};
