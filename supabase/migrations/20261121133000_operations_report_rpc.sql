create or replace function public.get_operations_report(
  p_start_date date default (current_date - 29),
  p_end_date date default current_date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path to pg_catalog, public, private
as $function$
declare
  result jsonb;
begin
  if coalesce(private.get_my_role(), '') not in ('Finance', 'Super Admin') then
    raise exception 'Insufficient permissions to view financial and operations reports'
      using errcode = '42501';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'A valid report date range is required'
      using errcode = '22023';
  end if;

  if p_end_date - p_start_date > 365 then
    raise exception 'Report date ranges cannot exceed 366 days'
      using errcode = '22023';
  end if;

  with scoped_shipments as (
    select
      s.id,
      s.client_id,
      s.current_status,
      s.payment_status,
      s.shipment_type,
      s.service_type,
      s.agreed_amount,
      upper(coalesce(nullif(btrim(s.currency), ''), 'NGN')) as currency,
      s.created_at
    from public.shipments s
    where s.company_id = private.get_my_company_id()
      and s.created_at >= p_start_date::timestamptz
      and s.created_at < (p_end_date + 1)::timestamptz
  ),
  status_rows as (
    select
      coalesce(nullif(btrim(current_status), ''), 'Unknown') as label,
      count(*)::bigint as shipment_count
    from scoped_shipments
    group by 1
  ),
  monthly_rows as (
    select
      date_trunc('month', created_at)::date as period,
      count(*)::bigint as shipment_count
    from scoped_shipments
    group by 1
  ),
  type_rows as (
    select
      coalesce(nullif(btrim(shipment_type), ''), 'Unspecified') as label,
      count(*)::bigint as shipment_count
    from scoped_shipments
    group by 1
  ),
  agreed_rows as (
    select currency, sum(coalesce(agreed_amount, 0)) as amount
    from scoped_shipments
    group by currency
  ),
  collection_rows as (
    select
      upper(coalesce(nullif(btrim(p.currency), ''), nullif(btrim(s.currency), ''), 'NGN')) as currency,
      sum(p.amount) as amount
    from public.payments p
    join public.shipments s
      on s.id = p.shipment_id
     and s.company_id = p.company_id
    where p.company_id = private.get_my_company_id()
      and p.created_at >= p_start_date::timestamptz
      and p.created_at < (p_end_date + 1)::timestamptz
    group by 1
  ),
  client_rows as (
    select
      coalesce(nullif(btrim(c.client_name), ''), 'Unassigned client') as client_name,
      count(*)::bigint as shipment_count
    from scoped_shipments s
    left join public.clients c
      on c.id = s.client_id
     and c.company_id = private.get_my_company_id()
    group by 1
    order by shipment_count desc, client_name asc
    limit 5
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'total_shipments', (select count(*) from scoped_shipments),
      'delivered_shipments', (select count(*) from scoped_shipments where current_status = 'Delivered'),
      'active_shipments', (select count(*) from scoped_shipments where current_status is distinct from 'Delivered'),
      'pending_payment_shipments', (select count(*) from scoped_shipments where payment_status = 'Pending')
    ),
    'status_breakdown', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'count', shipment_count) order by shipment_count desc, label)
      from status_rows
    ), '[]'::jsonb),
    'monthly_volume', coalesce((
      select jsonb_agg(jsonb_build_object('period', period, 'count', shipment_count) order by period)
      from monthly_rows
    ), '[]'::jsonb),
    'shipment_mix', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'count', shipment_count) order by shipment_count desc, label)
      from type_rows
    ), '[]'::jsonb),
    'agreed_value_by_currency', coalesce((
      select jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount) order by currency)
      from agreed_rows
    ), '[]'::jsonb),
    'collections_by_currency', coalesce((
      select jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount) order by currency)
      from collection_rows
    ), '[]'::jsonb),
    'top_clients', coalesce((
      select jsonb_agg(jsonb_build_object('client_name', client_name, 'shipment_count', shipment_count)
        order by shipment_count desc, client_name)
      from client_rows
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$function$;

revoke all on function public.get_operations_report(date, date) from public, anon;
grant execute on function public.get_operations_report(date, date) to authenticated;
