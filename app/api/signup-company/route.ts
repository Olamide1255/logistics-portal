import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { companyName, email, password } = await req.json();

    // 1. Setup Supabase Admin Client (using the Service Role Key)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 2. Create the Company
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert([{ name: companyName, status: 'Active' }])
      .select()
      .single();
      
    if (companyError) throw companyError;

    // 3. Create the Auth User (Auto-confirmed so they can log in instantly)
    const { data: user, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    });
    
    if (authError) {
      // Rollback: Delete the company if the user creation failed
      await supabaseAdmin.from('companies').delete().eq('id', company.id);
      throw authError;
    }

    // 4. Create the Profile linked to the Company as Super Admin
    const { error: profileError } = await supabaseAdmin.from('profiles').insert([{
      id: user.user.id,
      email: email,
      role: 'Super Admin',
      department: 'Management',
      company_id: company.id,
      is_platform_admin: false
    }]);
    
    if (profileError) throw profileError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}