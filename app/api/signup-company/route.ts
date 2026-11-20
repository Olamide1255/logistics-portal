import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { rateLimit, getClientIP } from '@/lib/rateLimit';

export async function POST(req: Request) {
  try {
    const ip = getClientIP(req);
    const { success } = rateLimit(`signup_${ip}`, 3, 60 * 60 * 1000);

    if (!success) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again in an hour.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const companyName =
      typeof body?.companyName === 'string' ? body.companyName.trim() : '';
    const email =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (companyName.length < 2 || companyName.length > 120) {
      return NextResponse.json(
        { error: 'Company name must be between 2 and 120 characters.' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json(
        { error: 'A valid email address is required.' },
        { status: 400 }
      );
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
      console.error('Signup configuration is incomplete.');
      return NextResponse.json(
        { error: 'Signup is temporarily unavailable.' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Create the Auth user first. Supabase rejects duplicate email addresses,
    // so we do not need to enumerate the Auth user directory.
    const { data: userData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        // Keep the current signup experience working. Email verification
        // should be introduced as a separate, tested onboarding change.
        email_confirm: true
      });

    if (authError || !userData.user) {
      console.error('Signup Auth error:', authError);
      const alreadyExists = authError?.message.toLowerCase().includes('already');
      return NextResponse.json(
        {
          error: alreadyExists
            ? 'An account with this email already exists.'
            : 'Unable to create the account. Please check the details and try again.'
        },
        { status: alreadyExists ? 409 : 400 }
      );
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert([{ name: companyName, status: 'Active' }])
      .select('id')
      .single();

    if (companyError || !company) {
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
      console.error('Company creation error:', companyError);
      return NextResponse.json(
        { error: 'Failed to create workspace. Please try again.' },
        { status: 500 }
      );
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').insert([{
      id: userData.user.id,
      email,
      role: 'Super Admin',
      department: 'Management',
      company_id: company.id,
      is_platform_admin: false
    }]);

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
      await supabaseAdmin.from('companies').delete().eq('id', company.id);
      console.error('Profile creation error:', profileError);
      return NextResponse.json(
        { error: 'Failed to set up the administrator account. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, companyId: company.id });
  } catch (error) {
    console.error('SIGNUP FATAL:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
