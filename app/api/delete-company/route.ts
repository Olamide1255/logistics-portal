import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Permanent tenant deletion is intentionally disabled until an audited,
// transactional account-retirement workflow is implemented. Use suspension.
export async function POST(req: Request) {
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Company administration is temporarily unavailable.' }, { status: 503 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || profile?.is_platform_admin !== true) {
    return NextResponse.json({ error: 'Only Platform Admins can manage company retirement.' }, { status: 403 });
  }

  return NextResponse.json(
    { error: 'Permanent company deletion is disabled. Suspend the company instead to preserve its users and audit history.' },
    { status: 410 },
  );
}
