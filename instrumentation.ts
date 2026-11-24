import type { Instrumentation } from 'next';
import { captureSentryException } from './lib/sentry';

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await captureSentryException(error, {
    route: context.routePath,
    method: request.method,
    source: `next-${context.routeType}`,
  });
};
