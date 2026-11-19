import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { rateLimit, getClientIP } from '@/lib/rateLimit';

export async function POST(req: Request) {
  try {
    const ip = getClientIP(req);
    const { success } = rateLimit(`invite_${ip}`, 10, 60 * 60 * 1000, req);
    if (!success) return NextResponse.json({ error: 'Too many invites.' }, { status: 429 });

    // 1. Get Auth Header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 2. Verify Caller
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const { email, role, department, companyId } = await req.json();
    if (!email || !companyId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    // 3. Verify Caller Permissions
    const { data: callerProfile } = await supabaseAdmin.from('profiles').select('role, company_id, is_platform_admin').eq('id', caller.id).single();
    const isAuthorized = callerProfile?.is_platform_admin || (callerProfile?.role === 'Super Admin' && callerProfile?.company_id === companyId);
    
    if (!isAuthorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (role === 'Super Admin' && !callerProfile?.is_platform_admin) return NextResponse.json({ error: 'Only platform admins can create Super Admins' }, { status: 403 });

    // 4. Execute Invite
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (inviteError) throw inviteError;

    const { error: profileError } = await supabaseAdmin.from('profiles').insert([{
      id: inviteData.user.id, email, role, department, company_id: companyId
    }]);
    if (profileError) throw profileError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}