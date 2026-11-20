// Best-effort in-memory limiter for a single running process.
// NOTE: Serverless instances do not share memory. Replace this with a
// persistent shared limiter before relying on it for production-scale abuse prevention.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (rateLimitMap.size > 10000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetAt <= now) rateLimitMap.delete(key);
    }
  }

  if (!record || record.resetAt <= now) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: Math.max(0, limit - 1) };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0 };
  }

  record.count += 1;
  return { success: true, remaining: Math.max(0, limit - record.count) };
}

export function getClientIP(req: Request): string {
  // Vercel supplies x-real-ip. Fall back to the first forwarded address
  // for local development and other hosting environments.
  return (
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}
