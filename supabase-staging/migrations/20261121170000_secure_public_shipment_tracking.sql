-- Secure, unguessable customer-facing shipment tracking.
alter table public.shipments
  add column if not exists tracking_token text;

update public.shipments
set tracking_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where tracking_token is null;

alter table public.shipments
  alter column tracking_token set default (
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  ),
  alter column tracking_token set not null;

create unique index if not exists shipments_tracking_token_uidx
  on public.shipments (tracking_token);

comment on column public.shipments.tracking_token is
  'High-entropy opaque token used only for the safe public shipment tracking view.';

create or replace function public.get_public_shipment_tracking(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $function$
  select jsonb_build_object(
    'awb_number', s.awb_number,
    'origin', s.origin,
    'destination', s.destination,
    'current_status', case
      when s.current_status = any(array[
        'Registered', 'Booked', 'Picked Up', 'Handed to Ops',
        'Export Cleared', 'Handed to Airline', 'Delivered'
      ]::text[]) then s.current_status
      else 'In progress'
    end,
    'created_at', s.created_at,
    'expected_delivery_date', s.expected_delivery_date,
    'company', jsonb_build_object(
      'name', c.name,
      'logo_url', c.logo_url
    ),
    'milestones', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'status', t.status_dropdown,
          'occurred_at', t.created_at
        )
        order by t.created_at asc
      )
      from public.shipment_timeline t
      where t.shipment_id = s.id
        and t.company_id = s.company_id
        and t.status_dropdown = any(array[
          'Registered', 'Booked', 'Picked Up', 'Handed to Ops',
          'Export Cleared', 'Handed to Airline', 'Delivered'
        ]::text[])
    ), '[]'::jsonb)
  )
  from public.shipments s
  join public.companies c on c.id = s.company_id
  where s.tracking_token = p_token
    and c.status = 'Active'
  limit 1;
$function$;

revoke all on function public.get_public_shipment_tracking(text) from public;
grant execute on function public.get_public_shipment_tracking(text) to anon, authenticated;

-- Expose the opaque token only through the tenant-scoped, role-safe view.
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
