import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { createClient } from '@supabase/supabase-js';

type RateLimitResult = {
  success: boolean;
  remaining: number;
  retryAfterMs: number;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('Rate limiting is not configured.');
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function consumeUpstashRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash Redis is not configured.');

  const bucket = Math.floor(Date.now() / windowMs);
  const retryAfterMs = windowMs - (Date.now() % windowMs);
  const prefix = process.env.UPSTASH_REDIS_PREFIX || 'logiflow:ratelimit';
  const redisKey = `${prefix}:${key}:${bucket}`;
  const response = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', redisKey],
      ['PEXPIRE', redisKey, windowMs + 1000],
    ]),
    cache: 'no-store',
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) throw new Error(`Upstash Redis returned HTTP ${response.status}.`);

  const results = await response.json() as Array<{ result?: unknown; error?: string }>;
  const count = Number(results?.[0]?.result);
  if (!Number.isFinite(count) || results?.[0]?.error || results?.[1]?.error) {
    throw new Error('Upstash Redis returned an invalid rate-limit response.');
  }

  return {
    success: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterMs: count > limit ? retryAfterMs : 0,
  };
}

async function consumeSupabaseRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const { data, error } = await getAdminClient().rpc('consume_rate_limit', {
    p_identifier: key,
    p_limit: limit,
    p_window_ms: windowMs,
  });

  if (error || !data || typeof data.success !== 'boolean') {
    console.error('Durable rate-limit check failed:', error);
    throw new Error('Rate limiting is temporarily unavailable.');
  }

  return {
    success: data.success,
    remaining: Number(data.remaining ?? 0),
    retryAfterMs: Number(data.retryAfterMs ?? 0),
  };
}

export async function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const key = createHash('sha256').update(identifier).digest('hex');

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await consumeUpstashRateLimit(key, limit, windowMs);
    } catch (error) {
      // Supabase remains the durable fallback so Redis outages never silently
      // disable protection on signup, invitations or monitoring endpoints.
      console.error('Upstash rate-limit check failed; using Supabase fallback:', error);
    }
  }

  return consumeSupabaseRateLimit(key, limit, windowMs);
}

export function getClientIP(req: Request): string {
  // On Vercel, use only the platform-provided client-IP header. Do not fall
  // back to generic forwarding headers: those may be supplied by an
  // untrusted proxy or caller outside Vercel's trusted request boundary.
  const platformIP = req.headers.get('x-vercel-forwarded-for')?.trim();
  if (!platformIP || platformIP.includes(',')) return 'unknown';

  return isIP(platformIP) ? platformIP : 'unknown';
}
