import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const healthHeaders = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: healthHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
    );

    const [database, auth, documentsBucket] = await Promise.all([
      supabaseAdmin.from('companies').select('id').limit(1),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 }),
      supabaseAdmin.storage.getBucket('shipment-documents'),
    ]);

    if (database.error || auth.error || documentsBucket.error || !documentsBucket.data || documentsBucket.data.public) {
      console.error('Backend health check failed.', {
        database: Boolean(database.error),
        auth: Boolean(auth.error),
        storage: Boolean(documentsBucket.error || !documentsBucket.data || documentsBucket.data.public),
      });
      return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: healthHeaders });
    }

    return NextResponse.json({ status: 'ok' }, { status: 200, headers: healthHeaders });
  } catch (error) {
    console.error('Backend health check threw an error.', error);
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: healthHeaders });
  }
}
