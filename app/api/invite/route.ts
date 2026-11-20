import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { rateLimit, getClientIP } from '@/lib/rateLimit';

const ALLOWED_ROLES = [
  'Customer Service',
  'Finance',
  'Freight',
  'RFS',
  'Operations',
  'Super Admin',
] as const;

const ALLOWED_DEPARTMENTS = [
  'Customer Service',
  'Finance',
  'Freight',
  'RFS',
  'Operations',
  'Management',
] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const ip = getClientIP(req);
  const { success } = rateLimit(`invite_${ip}`, 10, 60 * 60 * 1000);

  if (!success) {
    return NextResponse.json({ error: 'Too many invites. Please try again later.' }, { status: 429 });
  }

  try {
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
      console.error('Invite API is missing required Supabase environment configuration.');
      return NextResponse.json({ error: 'Invitation service is temporarily unavailable.' }, { status: 503 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user: caller },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !caller) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const requestedRole = typeof body.role === 'string' ? body.role : '';
    const requestedDepartment = typeof body.department === 'string' ? body.department : '';
    const requestedCompanyId = typeof body.companyId === 'string' ? body.companyId : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }

    if (!ALLOWED_ROLES.includes(requestedRole as (typeof ALLOWED_ROLES)[number])) {
      return NextResponse.json({ error: 'The selected role is not permitted.' }, { status: 400 });
    }

    if (!ALLOWED_DEPARTMENTS.includes(requestedDepartment as (typeof ALLOWED_DEPARTMENTS)[number])) {
      return NextResponse.json({ error: 'The selected department is not permitted.' }, { status: 400 });
    }

    if (!UUID_PATTERN.test(requestedCompanyId)) {
      return NextResponse.json({ error: 'A valid company is required.' }, { status: 400 });
    }

    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role, company_id, is_platform_admin')
      .eq('id', caller.id)
      .maybeSingle();

    if (callerProfileError || !callerProfile) {
      return NextResponse.json({ error: 'Unable to verify account permissions.' }, { status: 403 });
    }

    const isPlatformAdmin = callerProfile.is_platform_admin === true;
    const isCompanyAdmin = callerProfile.role === 'Super Admin' && !!callerProfile.company_id;

    if (!isPlatformAdmin && !isCompanyAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (requestedRole === 'Super Admin' && !isPlatformAdmin) {
      return NextResponse.json(
        { error: 'Only platform administrators can appoint a company Super Admin.' },
        { status: 403 },
      );
    }

    const targetCompanyId = isPlatformAdmin ? requestedCompanyId : callerProfile.company_id;

    if (!isPlatformAdmin && requestedCompanyId !== callerProfile.company_id) {
      return NextResponse.json({ error: 'You can only invite users into your own company.' }, { status: 403 });
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('id', targetCompanyId)
      .maybeSingle();

    if (companyError || !company) {
      return NextResponse.json({ error: 'The selected company does not exist.' }, { status: 404 });
    }

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (inviteError || !inviteData.user) {
      console.error('Employee invitation failed:', inviteError);
      return NextResponse.json(
        { error: inviteError?.message || 'Unable to create the invitation.' },
        { status: 400 },
      );
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: inviteData.user.id,
      email,
      role: requestedRole,
      department: requestedDepartment,
      company_id: targetCompanyId,
      is_platform_admin: false,
    });

    if (profileError) {
      const { error: cleanupError } = await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id);
      if (cleanupError) {
        console.error('Failed to clean up auth user after profile creation failed:', cleanupError);
      }
      console.error('Employee profile creation failed:', profileError);
      return NextResponse.json(
        { error: 'The invitation could not be completed. Please try again.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Invite API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred while creating the invitation.' }, { status: 500 });
  }
}
