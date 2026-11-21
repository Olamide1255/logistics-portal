-- Limit public tracking to customer-safe shipment milestones.
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
    'expected_delivery_date', null,
    'company', jsonb_build_object('name', c.name, 'logo_url', c.logo_url),
    'milestones', coalesce((
      select jsonb_agg(
        jsonb_build_object('status', t.status_dropdown, 'occurred_at', t.created_at)
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
