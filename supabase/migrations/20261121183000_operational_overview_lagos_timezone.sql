create or replace function public.get_operational_overview(
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
  report_today date := timezone('Africa/Lagos', now())::date;
begin
  if private.get_my_company_id() is null or private.get_my_role() is null then
    raise exception 'An active tenant profile is required'
      using errcode = '42501';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'A valid reporting date range is required'
      using errcode = '22023';
  end if;

  if p_end_date - p_start_date > 365 then
    raise exception 'Reporting date ranges cannot exceed 366 days'
      using errcode = '22023';
  end if;

  with all_tenant_shipments as (
    select
      s.id,
      s.current_status,
      s.shipment_type,
      s.created_at
    from public.shipments s
    where s.company_id = private.get_my_company_id()
  ),
  period_shipments as (
    select *
    from all_tenant_shipments
    where timezone('Africa/Lagos', created_at)::date between p_start_date and p_end_date
  ),
  status_rows as (
    select coalesce(nullif(btrim(current_status), ''), 'Unknown') as label,
           count(*)::bigint as shipment_count
    from period_shipments
    group by 1
  ),
  daily_rows as (
    select timezone('Africa/Lagos', created_at)::date as day, count(*)::bigint as shipment_count
    from period_shipments
    group by 1
  ),
  type_rows as (
    select coalesce(nullif(btrim(shipment_type), ''), 'Unspecified') as label,
           count(*)::bigint as shipment_count
    from period_shipments
    group by 1
  ),
  age_rows as (
    select
      case
        when report_today - timezone('Africa/Lagos', created_at)::date <= 2 then '0–2 days'
        when report_today - timezone('Africa/Lagos', created_at)::date <= 7 then '3–7 days'
        when report_today - timezone('Africa/Lagos', created_at)::date <= 14 then '8–14 days'
        when report_today - timezone('Africa/Lagos', created_at)::date <= 30 then '15–30 days'
        else '31+ days'
      end as age_bucket,
      case
        when report_today - timezone('Africa/Lagos', created_at)::date <= 2 then 1
        when report_today - timezone('Africa/Lagos', created_at)::date <= 7 then 2
        when report_today - timezone('Africa/Lagos', created_at)::date <= 14 then 3
        when report_today - timezone('Africa/Lagos', created_at)::date <= 30 then 4
        else 5
      end as sort_order,
      count(*)::bigint as shipment_count
    from all_tenant_shipments
    where current_status is distinct from 'Delivered'
    group by 1, 2
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'total_shipments', (select count(*) from all_tenant_shipments),
      'created_in_period', (select count(*) from period_shipments),
      'delivered_in_period', (select count(*) from period_shipments where current_status = 'Delivered'),
      'active_shipments', (select count(*) from all_tenant_shipments where current_status is distinct from 'Delivered')
    ),
    'status_breakdown', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'count', shipment_count)
        order by shipment_count desc, label) from status_rows
    ), '[]'::jsonb),
    'daily_volume', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'count', shipment_count) order by day)
      from daily_rows
    ), '[]'::jsonb),
    'shipment_mix', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'count', shipment_count)
        order by shipment_count desc, label) from type_rows
    ), '[]'::jsonb),
    'active_age', coalesce((
      select jsonb_agg(jsonb_build_object('label', age_bucket, 'count', shipment_count)
        order by sort_order) from age_rows
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$function$;

revoke all on function public.get_operational_overview(date, date) from public, anon;
grant execute on function public.get_operational_overview(date, date) to authenticated;