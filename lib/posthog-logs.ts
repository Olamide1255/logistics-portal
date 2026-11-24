type PostHogAttribute = { key: string; value: { stringValue: string } };

function attribute(key: string, value: string): PostHogAttribute {
  return { key, value: { stringValue: value.slice(0, 180) } };
}

/**
 * Sends a single, privacy-minimized OTLP log record to PostHog.
 * Uses the existing consent-independent server project token; no browser/session
 * identifiers, request headers, raw exception messages, or stacks are exported.
 */
export async function capturePostHogLog(input: {
  message: string;
  severityNumber?: number;
  severityText?: 'INFO' | 'WARN' | 'ERROR';
  attributes?: Record<string, string>;
}) {
  const token = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!token) return;

  const configuredHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
  let endpoint: string;
  try {
    const host = new URL(configuredHost);
    if (host.protocol !== 'https:' && host.protocol !== 'http:') return;
    endpoint = new URL('/i/v1/logs', host).toString();
  } catch {
    return;
  }

  const now = (BigInt(Date.now()) * 1_000_000n).toString();
  const safeAttributes = Object.entries(input.attributes || {})
    .filter(([key, value]) => /^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(key) && typeof value === 'string')
    .slice(0, 12)
    .map(([key, value]) => attribute(key, value));

  const payload = {
    resourceLogs: [{
      resource: {
        attributes: [
          attribute('service.name', 'logiflow'),
          attribute('deployment.environment', process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'),
        ],
      },
      scopeLogs: [{
        scope: { name: 'logiflow.server' },
        logRecords: [{
          timeUnixNano: now,
          observedTimeUnixNano: now,
          severityNumber: input.severityNumber ?? 17,
          severityText: input.severityText ?? 'ERROR',
          body: { stringValue: input.message.slice(0, 240) },
          attributes: safeAttributes,
        }],
      }],
    }],
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) {
      console.warn('PostHog log delivery failed:', response.status);
    }
  } catch {
    // Telemetry must never interrupt the user's request or error reporting.
  }
}
