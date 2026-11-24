import { NextResponse } from 'next/server';
import { rateLimit, getClientIP } from '@/lib/rateLimit';
import { captureSentryException } from '@/lib/sentry';

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return new NextResponse(null, { status: 403 });
  }

  try {
    const ip = getClientIP(request);
    const limit = await rateLimit(`client-error:${ip}`, 20, 60_000);
    if (!limit.success) return new NextResponse(null, { status: 429 });

    const body = await request.json() as { message?: unknown; stack?: unknown; path?: unknown };
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : '';
    const stack = typeof body.stack === 'string' ? body.stack.slice(0, 2500) : '';
    const path = typeof body.path === 'string' ? body.path.replace(/\?.*$/, '').slice(0, 180) : 'unknown';
    if (!message) return new NextResponse(null, { status: 400 });

    const error = new Error(message);
    error.stack = stack || undefined;
    await captureSentryException(error, { route: path, source: 'browser' });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Client error reporting request failed:', error);
    return new NextResponse(null, { status: 204 });
  }
}
