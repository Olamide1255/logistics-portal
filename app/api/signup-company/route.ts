import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { rateLimit, getClientIP } from '@/lib/rateLimit';

export async function POST(req: Request) {
  try {
    // 1. RATE LIMIT: Max 3 signups per IP per hour
    const ip = getClientIP(req);
    const { success, remaining } = rateLimit(`signup_${ip}`, 3, 60 * 60 * 1000);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again in an hour.' },
        { status: 429 }
      );
    }

    const { companyName, email, password } = await req.json();

    // 2. VALIDATION
    if (!companyName || companyName.trim().length < 2) {
      return NextResponse.json({ error: 'Company name must be at least 2 characters.' }, { status: 400 });
    }
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 3. CHECK IF EMAIL ALREADY EXISTS
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUsers?.users.some(u => u.email === email.toLowerCase().trim());
    if (emailExists) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    // 4. CREATE COMPANY
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert([{ name: companyName.trim(), status: 'Active' }])
      .select()
      .single();
      
    if (companyError) {
      console.error('Company creation error:', companyError);
      return NextResponse.json({ error: 'Failed to create workspace. Please try again.' }, { status: 500 });
    }

    // 5. CREATE USER
    const { data: user, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: password,
      email_confirm: true
    });
    
    if (authError) {
      await supabaseAdmin.from('companies').delete().eq('id', company.id);
      console.error('User creation error:', authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // 6. CREATE PROFILE
    const { error: profileError } = await supabaseAdmin.from('profiles').insert([{
      id: user.user.id,
      email: email.toLowerCase().trim(),
      role: 'Super Admin',
      department: 'Management',
      company_id: company.id,
      is_platform_admin: false
    }]);
    
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(user.user.id);
      await supabaseAdmin.from('companies').delete().eq('id', company.id);
      console.error('Profile creation error:', profileError);
      return NextResponse.json({ error: 'Failed to set up admin account. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, companyId: company.id });
  } catch (error: any) {
    console.error('SIGNUP FATAL:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}