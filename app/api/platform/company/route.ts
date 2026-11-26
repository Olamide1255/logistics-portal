import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(req: Request) {
  try {
    const authorization = req.headers.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Company administration is temporarily unavailable.' },
        { status: 503 }
      );
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await admin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || profile?.is_platform_admin !== true) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'A valid JSON request is required.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;

    if (
      Object.keys(input).length !== 3 ||
      !['companyId', 'action', 'value'].every(key => key in input)
    ) {
      return NextResponse.json({ error: 'Invalid request fields.' }, { status: 400 });
    }

    const companyId = input.companyId;
    const action = input.action;
    const value = input.value;

    if (typeof companyId !== 'string' || !UUID_PATTERN.test(companyId)) {
      return NextResponse.json({ error: 'A valid company is required.' }, { status: 400 });
    }

    let updates: { status?: string; subscription_tier?: string };

    if (action === 'status' && ['Active', 'Suspended'].includes(value as string)) {
      updates = { status: value as string };
    } else if (
      action === 'subscription_tier' &&
      ['Basic', 'Pro', 'Enterprise'].includes(value as string)
    ) {
      updates = { subscription_tier: value as string };
    } else {
      return NextResponse.json({ error: 'The requested company update is not permitted.' }, { status: 400 });
    }

    const { data: company, error: updateError } = await admin
      .from('companies')
      .update(updates)
      .eq('id', companyId)
      .select('id')
      .maybeSingle();

    if (updateError) {
      console.error('Platform company update failed:', updateError);
      return NextResponse.json({ error: 'Unable to update the company.' }, { status: 500 });
    }

    if (!company) {
      return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Platform company API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
