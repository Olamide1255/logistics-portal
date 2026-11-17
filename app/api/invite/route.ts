import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { rateLimit, getClientIP } from '@/lib/rateLimit';

export async function POST(req: Request) {
  try {
    const ip = getClientIP(req);
    const { success } = rateLimit(`invite_${ip}`, 10, 60 * 60 * 1000); // 10 invites/hour
    
    if (!success) {
      return NextResponse.json({ error: 'Too many invites. Try again later.' }, { status: 429 });
    }

    const { email, role, department, companyId } = await req.json();

    if (!email || !companyId) {
      return NextResponse.json({ error: 'Email and company are required.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (inviteError) throw inviteError;

    const { error: profileError } = await supabaseAdmin.from('profiles').insert([{
      id: inviteData.user.id,
      email: email,
      role: role,
      department: department,
      company_id: companyId
    }]);

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id);
      throw profileError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('INVITE ERROR:', error);
    return NextResponse.json({ error: error.message || 'Invite failed.' }, { status: 500 });
  }
}