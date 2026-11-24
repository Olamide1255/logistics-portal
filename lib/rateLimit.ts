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

export async function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const key = createHash('sha256').update(identifier).digest('hex');
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

export function getClientIP(req: Request): string {
  // On Vercel, use only the platform-provided client-IP header. Do not fall
  // back to generic forwarding headers: those may be supplied by an
  // untrusted proxy or caller outside Vercel's trusted request boundary.
  const platformIP = req.headers.get('x-vercel-forwarded-for')?.trim();
  if (!platformIP || platformIP.includes(',')) return 'unknown';

  return isIP(platformIP) ? platformIP : 'unknown';
}
