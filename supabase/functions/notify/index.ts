import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import * as OneSignal from "npm:@onesignal/node-onesignal@1.0.0-beta7";

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!;

const configuration = OneSignal.createConfiguration({
  restApiKey: ONESIGNAL_REST_API_KEY,
});
const client = new OneSignal.DefaultApi(configuration);

serve(async (req) => {
  try {
    const payload = await req.json();
    const newNotification = payload.record;

    // Only send if the event is an INSERT
    if (payload.type === 'INSERT') {
      const notification = new OneSignal.Notification();
      notification.app_id = ONESIGNAL_APP_ID;
      
      // Target users who have the matching role tag
      notification.filters = [
        { field: "tag", key: "role", relation: "=", value: newNotification.role_target }
      ];

      notification.headings = { en: newNotification.title };
      notification.contents = { en: newNotification.message };
      
      // If there is an AWB, make the notification clickable to open that page
      if (newNotification.shipment_awb) {
        notification.data = { url: `/dashboard/shipments/${newNotification.shipment_awb}` };
        // OneSignal uses the "url" parameter in the root of the request to handle clicks
        notification.url = `https://logistics-portal-mu.vercel.app/dashboard/shipments/${newNotification.shipment_awb}`;
      }

      const response = await client.createNotification(notification);
      console.log("OneSignal notification sent:", response);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});