// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record

    if (payload.type === 'INSERT') {
      const body = {
        app_id: ONESIGNAL_APP_ID,
        filters: [{ field: "tag", key: "role", relation: "=", value: record.role_target }],
        headings: { en: record.title },
        contents: { en: record.message },
        url: record.shipment_awb 
             ? `https://logistics-portal-mu.vercel.app/dashboard/shipments/${record.shipment_awb}` 
             : "https://logistics-portal-mu.vercel.app/dashboard"
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
    }

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { "Content-Type": "application/json" } })
  }
})