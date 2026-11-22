// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')

async function getVaultWebhookSecret() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Webhook secret service configuration is missing.')
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_notify_webhook_secret`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })

  if (!response.ok) {
    throw new Error('Webhook secret lookup failed.')
  }

  const secret = await response.json()
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('Webhook secret is unavailable.')
  }
  return secret
}

serve(async (req) => {
  try {
    const expectedSecret = await getVaultWebhookSecret()
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${expectedSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const payload = await req.json()
    const record = payload?.record

    if (payload?.type !== 'INSERT' || !record) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (typeof record.company_id !== 'string' || !record.company_id) {
      console.warn('Notification webhook received a record without a company scope.')
      return new Response(JSON.stringify({ skipped: 'no company scope' }), { status: 200 })
    }

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.error('Notification delivery is not configured.')
      return new Response(JSON.stringify({ error: 'Notification delivery unavailable' }), { status: 503 })
    }

    const body = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: record.title },
      contents: { en: record.message },
      url: record.shipment_awb
        ? `https://logistics-portal-ten.vercel.app/dashboard/shipments/${encodeURIComponent(record.shipment_awb)}`
        : 'https://logistics-portal-ten.vercel.app/dashboard',
      filters: record.role_target === 'ALL'
        ? [{ field: 'tag', key: 'company_id', relation: '=', value: record.company_id }]
        : [
            { field: 'tag', key: 'company_id', relation: '=', value: record.company_id },
            { field: 'tag', key: 'role', relation: '=', value: record.role_target },
          ],
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json().catch(() => null)
    console.log('OneSignal notification delivery result', {
      status: response.status,
      recipients: data?.recipients ?? null,
      errorCount: Array.isArray(data?.errors) ? data.errors.length : 0,
    })

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Notification provider rejected the request' }), { status: 502 })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (error) {
    console.error('Notification webhook failed:', error instanceof Error ? error.message : 'Unknown error')
    return new Response(JSON.stringify({ error: 'Notification processing failed' }), { status: 500 })
  }
})
