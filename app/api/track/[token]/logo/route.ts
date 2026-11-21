import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const COMPANY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function redirectToFallback(requestUrl: string) {
  const response = NextResponse.redirect(new URL('/icon-192.png', requestUrl), 302);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    if (!TOKEN_PATTERN.test(token)) {
      return NextResponse.json({ error: 'Invalid tracking token.' }, { status: 404 });
    }

    const limit = await rateLimit(`public_tracking_logo:${token}`, 60, 60 * 60 * 1000);
    if (!limit.success) return redirectToFallback(request.url);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) return redirectToFallback(request.url);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: shipment, error: shipmentError } = await admin
      .from('shipments')
      .select('company_id')
      .eq('tracking_token', token)
      .maybeSingle();

    if (shipmentError || !shipment?.company_id || !COMPANY_ID_PATTERN.test(shipment.company_id)) {
      return redirectToFallback(request.url);
    }

    const { data: company, error: companyError } = await admin
      .from('companies')
      .select('status, logo_url')
      .eq('id', shipment.company_id)
      .maybeSingle();

    if (companyError || company?.status !== 'Active' || typeof company.logo_url !== 'string') {
      return redirectToFallback(request.url);
    }

    // Only sign a logo path owned by the same tenant as the tracking token.
    // External URLs and arbitrary storage paths deliberately fall back to the app icon.
    const escapedCompanyId = shipment.company_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const allowedLogoPath = new RegExp(
      `^${escapedCompanyId}/(?:company-logo/)?logo-[a-z0-9-]+\\.(?:png|jpg)$`,
      'i',
    );
    if (!allowedLogoPath.test(company.logo_url)) return redirectToFallback(request.url);

    const { data: signed, error: signedError } = await admin.storage
      .from('shipment-documents')
      .createSignedUrl(company.logo_url, 60 * 60);

    if (signedError || !signed?.signedUrl) return redirectToFallback(request.url);

    const response = NextResponse.redirect(signed.signedUrl, 302);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    console.error('Public tracking logo request failed:', error);
    return redirectToFallback(request.url);
  }
}
