import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email, role, department, companyId } = await req.json();

    // 1. Setup Supabase Admin Client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 2. Invite the user (Supabase will send the email automatically)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    
    if (inviteError) throw inviteError;

    // 3. Add their profile with the correct Company ID, Role, and Department
    const { error: profileError } = await supabaseAdmin.from('profiles').insert([{
      id: inviteData.user.id,
      email: email,
      role: role,
      department: department,
      company_id: companyId
    }]);

    if (profileError) throw profileError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}