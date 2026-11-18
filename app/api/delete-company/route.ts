import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { companyId } = await req.json();
    
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Find all users in this company
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id').eq('company_id', companyId);
    
    // 2. Delete them from Auth (This will cascade to profiles)
    if (profiles && profiles.length > 0) {
      for (const profile of profiles) {
        await supabaseAdmin.auth.admin.deleteUser(profile.id);
      }
    }

    // 3. Delete the company
    const { error } = await supabaseAdmin.from('companies').delete().eq('id', companyId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}