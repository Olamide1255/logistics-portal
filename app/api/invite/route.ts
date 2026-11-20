import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { rateLimit, getClientIP } from '@/lib/rateLimit';

export async function POST(req: Request) {
  try {
    const ip = getClientIP(req);
    const { success } = rateLimit(`invite_${ip}`, 10, 60 * 60 * 1000);
    if (!success) {
      return NextResponse.json({ error: 'Too many invites.' }, { status: 429 });
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Invite configuration is incomplete.');
      return NextResponse.json({ error: 'Invitation is temporarily unavailable.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: { user: caller }, error: authError } =
      await supabaseAdmin.auth.getUser(token);

    if (authError || !caller) {
      return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
    }

    const body = await req.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = typeof body?.role === 'string' ? body.role.trim() : '';
    const department = typeof body?.department === 'string' ? body.department.trim() : '';
    const companyId = typeof body?.companyId === 'string' ? body.companyId : '';

    const allowedTenantRoles = ['Customer Service', 'Freight', 'Finance', 'RFS', 'Operations'];
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !companyId || !role) {
      return NextResponse.json({ error: 'Valid email, role, and company are required.' }, { status: 400 });
    }

    const { data: callerProfile, error: profileLookupError } = await supabaseAdmin
      .from('profiles')
      .select('role, company_id, is_platform_admin')
      .eq('id', caller.id)
      .single();

    if (profileLookupError || !callerProfile) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const isPlatformAdmin = callerProfile.is_platform_admin === true;
    const isCompanyAdmin =
      callerProfile.role === 'Super Admin' &&
      callerProfile.company_id === companyId;

    if (!isPlatformAdmin && !isCompanyAdmin) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // Tenant administrators may invite only operational staff. Platform
    // administrators may invite a tenant administrator into a company.
    if (isPlatformAdmin) {
      if (role !== 'Super Admin' && !allowedTenantRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
      }
    } else if (!allowedTenantRoles.includes(role)) {
      return NextResponse.json({ error: 'You cannot assign that role.' }, { status: 403 });
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .maybeSingle();

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
    }

    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (inviteError || !inviteData.user) {
      console.error('Invite Auth error:', inviteError);
      return NextResponse.json({ error: 'Unable to send the invitation.' }, { status: 400 });
    }

    const { error: newProfileError } = await supabaseAdmin.from('profiles').insert([{
      id: inviteData.user.id,
      email,
      role,
      department: department || role,
      company_id: companyId,
      is_platform_admin: false
    }]);

    if (newProfileError) {
      await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id);
      console.error('Invite profile error:', newProfileError);
      return NextResponse.json({ error: 'Unable to finish setting up the invited user.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('INVITE FATAL:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
