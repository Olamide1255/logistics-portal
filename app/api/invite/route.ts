import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { rateLimit, getClientIP } from '@/lib/rateLimit';
import { findAuthUserByEmail } from '@/lib/findAuthUserByEmail';

const ALLOWED_ROLES = ['Customer Service', 'Finance', 'Freight', 'RFS', 'Operations', 'Super Admin'] as const;
const ALLOWED_DEPARTMENTS = ['Customer Service', 'Finance', 'Freight', 'RFS', 'Operations', 'Management'] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('Invitation service is not configured.');
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function updateInviteState(
  admin: ReturnType<typeof getAdminClient>,
  companyId: string,
  state: 'pending' | 'sent' | 'failed',
  email: string,
  errorMessage?: string,
) {
  const { error } = await admin.from('companies').update({
    admin_invite_email: email,
    admin_invite_status: state,
    admin_invite_error: state === 'failed' ? (errorMessage || 'Invitation could not be completed.') : null,
    admin_invited_at: state === 'sent' ? new Date().toISOString() : null,
  }).eq('id', companyId);
  if (error) throw error;
}

export async function POST(req: Request) {
  let admin: ReturnType<typeof getAdminClient> | null = null;
  let targetCompanyId = '';
  let email = '';

  try {
    const authorization = req.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    admin = getAdminClient();
    const token = authorization.slice('Bearer '.length).trim();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user: caller }, error: authError } = await admin.auth.getUser(token);
    if (authError || !caller) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'A valid JSON request is required.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invitation details are required.' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const requestedRole = typeof input.role === 'string' ? input.role : '';
    const requestedDepartment = typeof input.department === 'string' ? input.department : '';
    const requestedCompanyId = typeof input.companyId === 'string' ? input.companyId : '';

    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || email.length > 254) {
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

    const { data: callerProfile, error: callerProfileError } = await admin
      .from('profiles')
      .select('role, company_id, is_platform_admin')
      .eq('id', caller.id)
      .maybeSingle();

    if (callerProfileError || !callerProfile) {
      return NextResponse.json({ error: 'Unable to verify account permissions.' }, { status: 403 });
    }

    const isPlatformAdmin = callerProfile.is_platform_admin === true;
    const isCompanyAdmin = callerProfile.role === 'Super Admin' && !!callerProfile.company_id;
    if (!isPlatformAdmin && !isCompanyAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (requestedRole === 'Super Admin' && !isPlatformAdmin) {
      return NextResponse.json({ error: 'Only platform administrators can appoint a company Super Admin.' }, { status: 403 });
    }

    targetCompanyId = isPlatformAdmin ? requestedCompanyId : callerProfile.company_id!;
    if (!isPlatformAdmin && requestedCompanyId !== callerProfile.company_id) {
      return NextResponse.json({ error: 'You can only invite users into your own company.' }, { status: 403 });
    }

    const { data: company, error: companyError } = await admin
      .from('companies')
      .select('id, admin_invite_email, admin_invite_status')
      .eq('id', targetCompanyId)
      .maybeSingle();

    if (companyError || !company) return NextResponse.json({ error: 'The selected company does not exist.' }, { status: 404 });

    const [userLimit, ipLimit] = await Promise.all([
      rateLimit('invite:user:' + caller.id, 10, 60 * 60 * 1000),
      rateLimit('invite:ip:' + getClientIP(req), 30, 60 * 60 * 1000),
    ]);
    const success = userLimit.success && ipLimit.success;
    const retryAfterMs = Math.max(userLimit.retryAfterMs, ipLimit.retryAfterMs);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many invitation attempts. Please try again later.', retryAfterMs },
        { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterMs / 1000))) } },
      );
    }

    await updateInviteState(admin, targetCompanyId, 'pending', email);

    // If the first attempt created the Auth user but failed before creating its profile,
    // reuse that pending identity instead of creating a duplicate or deleting the account.
    const existingUser = await findAuthUserByEmail(admin, email);

    let authUserId: string;
    if (existingUser) {
      const { data: existingProfile, error: existingProfileError } = await admin
        .from('profiles')
        .select('id, company_id, role')
        .eq('id', existingUser.id)
        .maybeSingle();
      if (existingProfileError) throw existingProfileError;

      if (existingProfile) {
        if (existingProfile.company_id !== targetCompanyId || existingProfile.role !== requestedRole) {
          throw new Error('This email is already associated with another account. Contact platform support.');
        }
        await updateInviteState(admin, targetCompanyId, 'sent', email);
        return NextResponse.json({ success: true, alreadyOnboarded: true });
      }

      // Confirmed identities can be attached without another email. Pending identities
      // receive a fresh confirmation message before the missing tenant profile is added.
      if (!existingUser.email_confirmed_at) {
        const { error: resendError } = await admin.auth.resend({ type: 'signup', email });
        if (resendError) throw new Error('The account exists but its invitation could not be resent: ' + resendError.message);
      }
      authUserId = existingUser.id;
    } else {
      const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
      if (inviteError || !inviteData.user) throw inviteError || new Error('Unable to create the invitation.');
      authUserId = inviteData.user.id;
    }

    const { error: profileError } = await admin.from('profiles').insert({
      id: authUserId,
      email,
      role: requestedRole,
      department: requestedDepartment,
      company_id: targetCompanyId,
      is_platform_admin: false,
    });

    if (profileError) {
      // Keep the Auth identity so the next retry can safely complete the missing profile.
      throw new Error('The invitation email was initiated, but the company profile could not be completed. Retry the invitation.');
    }

    await updateInviteState(admin, targetCompanyId, 'sent', email);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred while creating the invitation.';
    if (admin && targetCompanyId && email) {
      try { await updateInviteState(admin, targetCompanyId, 'failed', email, message); }
      catch (stateError) { console.error('Unable to persist invitation failure state:', stateError); }
    }
    console.error('Invite API error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
