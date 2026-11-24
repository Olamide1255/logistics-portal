type SentryContext = {
  route?: string;
  method?: string;
  source?: string;
  release?: string;
};

function getSentryEndpoint(dsn: string) {
  const parsed = new URL(dsn);
  const projectId = parsed.pathname.split('/').filter(Boolean).at(-1);
  if (!projectId || !parsed.username) return null;
  return {
    endpoint: `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/`,
    publicKey: parsed.username,
  };
}

export async function captureSentryException(error: unknown, context: SentryContext = {}) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  const target = getSentryEndpoint(dsn);
  if (!target) return;

  const exception = error instanceof Error ? error : new Error(String(error));
  const eventId = crypto.randomUUID().replace(/-/g, '');
  const safeRoute = (context.route || 'unknown').replace(/\?.*$/, '').slice(0, 180);
  const message = exception.message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .slice(0, 1000);
  const frames = (exception.stack || '').split('\n').slice(1, 25).reverse().map((line) => ({
    filename: line.trim().slice(0, 500),
    function: 'unknown',
  }));

  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'production',
    release: context.release || process.env.VERCEL_GIT_COMMIT_SHA,
    message,
    exception: { values: [{ type: exception.name || 'Error', value: message, ...(frames.length ? { stacktrace: { frames } } : {}) }] },
    tags: {
      app: 'logiflow',
      source: context.source || 'next-server',
      route: safeRoute,
      method: (context.method || 'unknown').slice(0, 12),
    },
  };
  const envelope = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');

  try {
    const response = await fetch(target.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=logiflow-http/1.0, sentry_key=${target.publicKey}`,
      },
      body: envelope,
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) console.error('Sentry event delivery failed:', response.status);
  } catch (deliveryError) {
    console.error('Sentry event delivery failed:', deliveryError);
  }
}
