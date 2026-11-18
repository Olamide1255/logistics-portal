// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')
const WEBHOOK_SECRET = Deno.env.get('LOGIFLOW_WEBHOOK_SECRET')

serve(async (req) => {
  try {
    // 1. VERIFY the request comes from Supabase (webhook), not an attacker
    const authHeader = req.headers.get('authorization')
    if (!WEBHOOK_SECRET || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const payload = await req.json()
    const record = payload.record

    if (payload.type !== 'INSERT' || !record) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    // 2. REQUIRE company_id on every notification
    if (!record.company_id) {
      console.warn('Notification missing company_id, skipping push to avoid leak:', record)
      return new Response(JSON.stringify({ skipped: 'no company_id' }), { status: 200 })
    }

    const body = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: record.title },
      contents: { en: record.message },
      url: record.shipment_awb 
        ? `https://logistics-portal-ten.vercel.app/dashboard/shipments/${record.shipment_awb}` 
        : "https://logistics-portal-ten.vercel.app/dashboard",
      // 3. CRITICAL: Filter by BOTH role AND company
      filters: record.role_target === 'ALL'
        ? [{ field: "tag", key: "company_id", relation: "=", value: record.company_id }]
        : [
            { field: "tag", key: "company_id", relation: "=", value: record.company_id },
            { field: "tag", key: "role", relation: "=", value: record.role_target }
          ]
    }

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()
    console.log("OneSignal Response:", data)
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})