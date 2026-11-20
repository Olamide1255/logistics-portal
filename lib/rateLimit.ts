import { createHash } from 'node:crypto';
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
  const forwarded = req.headers.get('x-vercel-forwarded-for')
    || req.headers.get('x-forwarded-for')
    || req.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}
