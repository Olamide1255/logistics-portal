import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { rateLimit, getClientIP } from '@/lib/rateLimit';
import { findAuthUserByEmail } from '@/lib/findAuthUserByEmail';

export async function POST(req: Request) {
  try {
    // RATE LIMIT: Max 3 signup attempts per IP per hour.
    const ip = getClientIP(req);
    const { success } = await rateLimit(`signup_${ip}`, 3, 60 * 60 * 1000);

    if (!success) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again in an hour.' },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'A valid JSON request is required.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Signup details are required.' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const companyName = typeof input.companyName === 'string' ? input.companyName.trim() : '';
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';

    // Validate and normalize untrusted public input before creating any records.
    if (companyName.length < 2 || companyName.length > 120) {
      return NextResponse.json(
        { error: 'Company name must be between 2 and 120 characters.' },
        { status: 400 }
      );
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }
    if (password.length < 12 || password.length > 128) {
      return NextResponse.json(
        { error: 'Password must be between 12 and 128 characters.' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Signup service is not configured.');
      return NextResponse.json({ error: 'Workspace registration is temporarily unavailable.' }, { status: 503 });
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // CHECK IF EMAIL ALREADY EXISTS.
    let existingUser;
    try {
      existingUser = await findAuthUserByEmail(supabaseAdmin, email);
    } catch (lookupError) {
      console.error('Unable to check existing signup identity:', lookupError);
      return NextResponse.json({ error: 'Unable to verify this email address. Please try again.' }, { status: 503 });
    }
    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    // CREATE COMPANY.
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert([{ name: companyName, status: 'Active' }])
      .select()
      .single();

    if (companyError) {
      console.error('Company creation error:', companyError);
      return NextResponse.json({ error: 'Failed to create workspace. Please try again.' }, { status: 500 });
    }

    // CREATE USER.
    const { data: user, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false
    });

    if (authError || !user.user) {
      await supabaseAdmin.from('companies').delete().eq('id', company.id);
      console.error('User creation error:', authError);
      return NextResponse.json(
        { error: 'Unable to create the administrator account. Please verify the details and try again.' },
        { status: 409 }
      );
    }

    // CREATE TENANT PROFILE.
    const { error: profileError } = await supabaseAdmin.from('profiles').insert([{
      id: user.user.id,
      email,
      role: 'Super Admin',
      department: 'Management',
      company_id: company.id,
      is_platform_admin: false
    }]);

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(user.user.id);
      await supabaseAdmin.from('companies').delete().eq('id', company.id);
      console.error('Profile creation error:', profileError);
      return NextResponse.json({ error: 'Failed to set up the administrator account. Please try again.' }, { status: 500 });
    }

    // Require proof of mailbox ownership before the new Super Admin can sign in.
    const redirectTo = new URL('/login', new URL(req.url).origin).toString();
    const { error: confirmationError } = await supabaseAdmin.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (confirmationError) {
      await supabaseAdmin.from('profiles').delete().eq('id', user.user.id);
      await supabaseAdmin.auth.admin.deleteUser(user.user.id);
      await supabaseAdmin.from('companies').delete().eq('id', company.id);
      console.error('Signup confirmation email error:', confirmationError);
      return NextResponse.json(
        { error: 'We could not send the verification email. Please try again later or contact support.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, companyId: company.id, emailConfirmationRequired: true });
  } catch (error: unknown) {
    console.error('SIGNUP FATAL:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
