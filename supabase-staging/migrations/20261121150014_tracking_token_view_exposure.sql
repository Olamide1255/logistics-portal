-- Make the opaque tracking token available only through the scoped secure view.
create or replace view public.shipments_secure
with (security_invoker = false, security_barrier = true)
as
select
  s.id, s.company_id, s.awb_number, s.client_id, s.shipment_type, s.service_type,
  s.sender_details, s.receiver_details, s.weight, s.dimensions, s.origin, s.destination,
  s.commodity_type, s.current_status, s.payment_status, s.created_at, s.currency,
  case when private.get_my_role() = any (array['Super Admin'::text, 'Customer Service'::text, 'Finance'::text, 'Freight'::text, 'Platform Admin'::text]) then s.rate else null::numeric end as rate,
  case when private.get_my_role() = any (array['Super Admin'::text, 'Customer Service'::text, 'Finance'::text, 'Freight'::text, 'Platform Admin'::text]) then s.agreed_amount else null::numeric end as agreed_amount,
  s.expected_delivery_date, s.payment_due_date, s.delivered_at, s.tracking_token
from public.shipments s
where private.is_platform_admin() or s.company_id = private.get_my_company_id();

alter view public.shipments_secure set (security_invoker = false, security_barrier = true);
grant select on public.shipments_secure to authenticated;
