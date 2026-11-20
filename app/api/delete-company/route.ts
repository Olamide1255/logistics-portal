import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const authorization = req.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const companyId = typeof body.companyId === 'string' ? body.companyId : '';
    if (!UUID_PATTERN.test(companyId)) {
      return NextResponse.json({ error: 'A valid company ID is required.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Company administration is temporarily unavailable.' }, { status: 503 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { data: callerProfile, error: profileLookupError } = await supabaseAdmin
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', caller.id)
      .maybeSingle();

    if (profileLookupError || callerProfile?.is_platform_admin !== true) {
      return NextResponse.json({ error: 'Only Platform Admins can delete companies.' }, { status: 403 });
    }

    const { data: company, error: companyLookupError } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .maybeSingle();

    if (companyLookupError || !company) {
      return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
    }

    const { data: profiles, error: usersLookupError } = await supabaseAdmin
      .from('profiles')
      .select('id, is_platform_admin')
      .eq('company_id', companyId);

    if (usersLookupError) {
      console.error('Company user lookup failed:', usersLookupError);
      return NextResponse.json({ error: 'Unable to verify company users.' }, { status: 500 });
    }

    if (profiles?.some(profile => profile.is_platform_admin === true)) {
      return NextResponse.json(
        { error: 'A Platform Admin is assigned to this company. Reassign that account before deletion.' },
        { status: 409 },
      );
    }

    for (const profile of profiles ?? []) {
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
      if (deleteUserError) {
        console.error('Company user deletion stopped:', deleteUserError);
        return NextResponse.json(
          { error: 'A user account could not be removed. The company record was retained; review the remaining accounts before retrying.' },
          { status: 500 },
        );
      }
    }

    const { error: deleteCompanyError } = await supabaseAdmin
      .from('companies')
      .delete()
      .eq('id', companyId);

    if (deleteCompanyError) {
      console.error('Company deletion failed after user cleanup:', deleteCompanyError);
      return NextResponse.json(
        { error: 'User cleanup completed, but company deletion was blocked by related records. The company record remains.' },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Company deletion API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred while deleting the company.' }, { status: 500 });
  }
}
