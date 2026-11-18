import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { rateLimit, getClientIP } from '@/lib/rateLimit';

export async function POST(req: Request) {
  try {
    const ip = getClientIP(req);
    const { success } = rateLimit(`invite_${ip}`, 20, 60 * 60 * 1000, req);
    if (!success) {
      return NextResponse.json({ error: 'Too many invites. Try again later.' }, { status: 429 });
    }

    // 1. AUTH CHECK: Extract the caller's JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const callerToken = authHeader.split(' ')[1];

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 2. VERIFY the caller is a Super Admin of THAT specific company
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(callerToken);
    if (authError || !caller) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { email, role, department, companyId } = await req.json();
    if (!email || !companyId || !role) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // 3. CHECK caller's profile against the TARGET company
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, company_id, is_platform_admin')
      .eq('id', caller.id)
      .single();

    const isAuthorized =
      callerProfile?.is_platform_admin === true ||
      (callerProfile?.role === 'Super Admin' && callerProfile?.company_id === companyId);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden: you can only invite to your own company.' }, { status: 403 });
    }

    // 4. Only the Platform Admin can create other Super Admins
    if (role === 'Super Admin' && !callerProfile?.is_platform_admin) {
      return NextResponse.json({ error: 'Only platform admins can create Super Admins.' }, { status: 403 });
    }

    // 5. Proceed with the invite
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (inviteError) throw inviteError;

    const { error: profileError } = await supabaseAdmin.from('profiles').insert([{
      id: inviteData.user.id,
      email,
      role,
      department,
      company_id: companyId
    }]);

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id);
      throw profileError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('INVITE ERROR:', error);
    return NextResponse.json({ error: 'Invite failed.' }, { status: 500 });
  }
}