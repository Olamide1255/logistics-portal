import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { rateLimit, getClientIP } from '@/lib/rateLimit';

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
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !publicKey || !serviceRoleKey) {
      console.error('Signup service is not configured.');
      return NextResponse.json({ error: 'Workspace registration is temporarily unavailable.' }, { status: 503 });
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
    );
    const supabasePublic = createClient(
      supabaseUrl,
      publicKey,
      { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false, flowType: 'implicit' } }
    );

    const defaultSiteUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://logistics-portal-ten.vercel.app';
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || defaultSiteUrl).replace(/\/+$/, '');
    const redirectTo = `${siteUrl}/auth/callback`;

    // Public signUp sends the confirmation email. Do not use admin.createUser here:
    // the Admin API creates an unconfirmed user but does not send a confirmation email.
    const { data: signupData, error: signupError } = await supabasePublic.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });

    const authUser = signupData?.user;
    if (signupError || !authUser) {
      if (authUser?.id) {
        const { error: cleanupError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
        if (cleanupError) console.error('Failed to clean up incomplete signup identity:', cleanupError);
      }
      console.error('Signup identity creation error:', signupError);
      return NextResponse.json(
        { error: 'Unable to create the administrator account or send its verification email. Please try again later.' },
        { status: 503 }
      );
    }

    // Supabase returns an obfuscated user with no identities for an existing email.
    if (Array.isArray(authUser.identities) && authUser.identities.length === 0) {
      return NextResponse.json(
        { error: 'This email cannot be used to create a new workspace. Sign in or use another address.' },
        { status: 409 }
      );
    }

    // A non-null session means email confirmation is disabled. Refuse to create
    // an unverified public administrator and remove the just-created identity.
    if (signupData.session) {
      const { error: cleanupError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      if (cleanupError) console.error('Failed to remove auto-confirmed signup identity:', cleanupError);
      return NextResponse.json(
        { error: 'Email verification is not enabled for this service. Please contact support.' },
        { status: 503 }
      );
    }

    // CREATE COMPANY.
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert([{ name: companyName, status: 'Active' }])
      .select('id')
      .single();

    if (companyError || !company) {
      const { error: cleanupError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      if (cleanupError) console.error('Failed to clean up signup identity:', cleanupError);
      console.error('Company creation error:', companyError);
      return NextResponse.json({ error: 'Failed to create workspace. Please try again.' }, { status: 500 });
    }

    // CREATE TENANT PROFILE.
    const { error: profileError } = await supabaseAdmin.from('profiles').insert([{
      id: authUser.id,
      email,
      role: 'Super Admin',
      department: 'Management',
      company_id: company.id,
      is_platform_admin: false
    }]);

    if (profileError) {
      await supabaseAdmin.from('companies').delete().eq('id', company.id);
      const { error: cleanupError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      if (cleanupError) console.error('Failed to clean up signup identity:', cleanupError);
      console.error('Profile creation error:', profileError);
      return NextResponse.json({ error: 'Failed to set up the administrator account. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, companyId: company.id, emailConfirmationRequired: true });
  } catch (error: unknown) {
    console.error('SIGNUP FATAL:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
