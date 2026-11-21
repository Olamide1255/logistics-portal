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
    'current_status', coalesce(s.current_status, 'In progress'),
    'created_at', s.created_at,
    'expected_delivery_date', null,
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
        and t.status_dropdown is not null
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
