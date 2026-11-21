create or replace view public.shipments_secure
with (security_invoker = true)
as
select
  id,
  company_id,
  awb_number,
  client_id,
  shipment_type,
  service_type,
  sender_details,
  receiver_details,
  weight,
  dimensions,
  origin,
  destination,
  commodity_type,
  current_status,
  payment_status,
  created_at,
  currency,
  case
    when private.get_my_role() = any (array['Super Admin'::text, 'Customer Service'::text, 'Finance'::text, 'Freight'::text, 'Platform Admin'::text])
      then rate
    else null::numeric
  end as rate,
  case
    when private.get_my_role() = any (array['Super Admin'::text, 'Customer Service'::text, 'Finance'::text, 'Freight'::text, 'Platform Admin'::text])
      then agreed_amount
    else null::numeric
  end as agreed_amount,
  expected_delivery_date,
  payment_due_date,
  delivered_at
from public.shipments;