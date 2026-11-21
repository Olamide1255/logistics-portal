create or replace view public.shipments_secure
with (security_invoker = false, security_barrier = true)
as
select
  s.id,
  s.company_id,
  s.awb_number,
  s.client_id,
  s.shipment_type,
  s.service_type,
  s.sender_details,
  s.receiver_details,
  s.weight,
  s.dimensions,
  s.origin,
  s.destination,
  s.commodity_type,
  s.current_status,
  s.payment_status,
  s.created_at,
  s.currency,
  case
    when private.get_my_role() = any (array['Super Admin'::text, 'Customer Service'::text, 'Finance'::text, 'Freight'::text, 'Platform Admin'::text])
      then s.rate
    else null::numeric
  end as rate,
  case
    when private.get_my_role() = any (array['Super Admin'::text, 'Customer Service'::text, 'Finance'::text, 'Freight'::text, 'Platform Admin'::text])
      then s.agreed_amount
    else null::numeric
  end as agreed_amount,
  s.expected_delivery_date,
  s.payment_due_date,
  s.delivered_at
from public.shipments s
where private.is_platform_admin()
   or s.company_id = private.get_my_company_id();

alter view public.shipments_secure set (security_invoker = false, security_barrier = true);
grant select on public.shipments_secure to authenticated;

-- The secure view is the tenant-facing read surface. Keep only the minimum
-- base-table read columns needed by scoped updates and operational RPCs.
revoke select on table public.shipments from authenticated;
grant select (
  id, company_id, awb_number, client_id, shipment_type, service_type,
  sender_details, receiver_details, weight, dimensions, origin, destination,
  commodity_type, current_status, payment_status, created_at, currency,
  expected_delivery_date, payment_due_date, delivered_at
) on table public.shipments to authenticated;

-- Financial reporting runs as a fixed-search-path definer function with
-- explicit Finance/Super Admin and tenant scoping checks.

create or replace function public.get_client_report_page(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path to pg_catalog, public, private
as $function$
declare
  result jsonb;
begin
  if coalesce(private.get_my_role(), '') not in ('Finance', 'Super Admin') then
    raise exception 'Insufficient permissions to view client financial reports'
      using errcode = '42501';
  end if;

  with filtered_clients as (
    select c.id, c.company_id, c.client_name, c.created_at
    from public.clients c
    where c.company_id = private.get_my_company_id()
      and (
        p_search is null
        or c.client_name ilike '%' || left(p_search, 120) || '%'
      )
  ),
  page_clients as (
    select fc.*
    from filtered_clients fc
    order by fc.client_name asc, fc.id asc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0)
  ),
  shipment_counts as (
    select s.client_id, count(*)::bigint as shipment_count
    from public.shipments s
    join page_clients c
      on c.id = s.client_id
     and c.company_id = s.company_id
    group by s.client_id
  ),
  billed as (
    select
      s.client_id,
      upper(coalesce(nullif(btrim(s.currency), ''), 'NGN')) as currency,
      sum(coalesce(s.agreed_amount, 0)) as billed
    from public.shipments s
    join page_clients c
      on c.id = s.client_id
     and c.company_id = s.company_id
    group by s.client_id, upper(coalesce(nullif(btrim(s.currency), ''), 'NGN'))
  ),
  paid as (
    select
      s.client_id,
      upper(coalesce(nullif(btrim(p.currency), ''), nullif(btrim(s.currency), ''), 'NGN')) as currency,
      sum(p.amount) as paid
    from public.payments p
    join public.shipments s
      on s.id = p.shipment_id
     and s.company_id = p.company_id
    join page_clients c
      on c.id = s.client_id
     and c.company_id = s.company_id
    group by
      s.client_id,
      upper(coalesce(nullif(btrim(p.currency), ''), nullif(btrim(s.currency), ''), 'NGN'))
  ),
  currency_rows as (
    select
      coalesce(b.client_id, p.client_id) as client_id,
      coalesce(b.currency, p.currency) as currency,
      coalesce(b.billed, 0) as billed,
      coalesce(p.paid, 0) as paid
    from billed b
    full outer join paid p
      on p.client_id = b.client_id
     and p.currency = b.currency
  ),
  financials as (
    select
      cr.client_id,
      jsonb_object_agg(
        cr.currency,
        jsonb_build_object('billed', cr.billed, 'paid', cr.paid)
      ) as financial_totals
    from currency_rows cr
    group by cr.client_id
  )
  select jsonb_build_object(
    'total_count', (select count(*) from filtered_clients),
    'rows', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'client_name', c.client_name,
            'created_at', c.created_at,
            'shipment_count', coalesce(sc.shipment_count, 0),
            'financial_totals', coalesce(f.financial_totals, '{}'::jsonb)
          )
          order by c.client_name asc, c.id asc
        )
        from page_clients c
        left join shipment_counts sc on sc.client_id = c.id
        left join financials f on f.client_id = c.id
      ),
      '[]'::jsonb
    )
  )
  into result;

  return result;
end;
$function$;

revoke all on function public.get_client_report_page(text, integer, integer) from public, anon;
grant execute on function public.get_client_report_page(text, integer, integer) to authenticated;

create or replace function public.get_operations_report(
  p_start_date date default (timezone('Africa/Lagos', now())::date - 29),
  p_end_date date default timezone('Africa/Lagos', now())::date
)
returns jsonb
language plpgsql
stable
security definer
set search_path to pg_catalog, public, private
as $function$
declare
  result jsonb;
  report_today date := timezone('Africa/Lagos', now())::date;
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
      and timezone('Africa/Lagos', s.created_at)::date between p_start_date and p_end_date
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
      date_trunc('month', timezone('Africa/Lagos', created_at))::date as period,
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
      and timezone('Africa/Lagos', p.created_at)::date between p_start_date and p_end_date
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
  ),
  delivery_rows as (
    select
      count(*)::bigint as eligible_deliveries,
      count(*) filter (
        where timezone('Africa/Lagos', s.delivered_at)::date <= s.expected_delivery_date
      )::bigint as on_time_deliveries,
      count(*) filter (
        where timezone('Africa/Lagos', s.delivered_at)::date > s.expected_delivery_date
      )::bigint as late_deliveries
    from public.shipments s
    where s.company_id = private.get_my_company_id()
      and s.current_status = 'Delivered'
      and s.expected_delivery_date is not null
      and timezone('Africa/Lagos', s.delivered_at)::date between p_start_date and p_end_date
  ),
  overdue_delivery as (
    select count(*)::bigint as overdue_count
    from public.shipments s
    where s.company_id = private.get_my_company_id()
      and s.current_status is distinct from 'Delivered'
      and s.expected_delivery_date < report_today
  ),
  payment_totals as (
    select p.shipment_id, p.company_id, sum(p.amount) as total_paid
    from public.payments p
    where p.company_id = private.get_my_company_id()
    group by p.shipment_id, p.company_id
  ),
  open_receivables as (
    select
      s.id,
      upper(coalesce(nullif(btrim(s.currency), ''), 'NGN')) as currency,
      s.payment_due_date,
      greatest(s.agreed_amount - coalesce(pt.total_paid, 0), 0) as outstanding
    from public.shipments s
    left join payment_totals pt
      on pt.shipment_id = s.id
     and pt.company_id = s.company_id
    where s.company_id = private.get_my_company_id()
      and s.agreed_amount > 0
  ),
  receivable_total_rows as (
    select currency, sum(outstanding) as amount, count(*)::bigint as invoice_count
    from open_receivables
    where outstanding > 0
    group by currency
  ),
  receivable_undated_rows as (
    select currency, sum(outstanding) as amount, count(*)::bigint as invoice_count
    from open_receivables
    where outstanding > 0 and payment_due_date is null
    group by currency
  ),
  receivable_ageing_rows as (
    select
      currency,
      case
        when report_today - payment_due_date between 1 and 30 then '1–30 days'
        when report_today - payment_due_date between 31 and 60 then '31–60 days'
        when report_today - payment_due_date between 61 and 90 then '61–90 days'
        else '91+ days'
      end as age_bucket,
      case
        when report_today - payment_due_date between 1 and 30 then 1
        when report_today - payment_due_date between 31 and 60 then 2
        when report_today - payment_due_date between 61 and 90 then 3
        else 4
      end as sort_order,
      sum(outstanding) as amount,
      count(*)::bigint as invoice_count
    from open_receivables
    where outstanding > 0 and payment_due_date < report_today
    group by currency, age_bucket, sort_order
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'total_shipments', (select count(*) from scoped_shipments),
      'delivered_shipments', (select count(*) from scoped_shipments where current_status = 'Delivered'),
      'active_shipments', (select count(*) from scoped_shipments where current_status is distinct from 'Delivered'),
      'pending_payment_shipments', (select count(*) from scoped_shipments where payment_status = 'Pending'),
      'overdue_delivery_shipments', (select overdue_count from overdue_delivery),
      'eligible_deliveries', (select eligible_deliveries from delivery_rows),
      'on_time_deliveries', (select on_time_deliveries from delivery_rows),
      'late_deliveries', (select late_deliveries from delivery_rows)
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
    'receivables_by_currency', coalesce((
      select jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount, 'invoice_count', invoice_count) order by currency)
      from receivable_total_rows
    ), '[]'::jsonb),
    'receivables_without_due_date', coalesce((
      select jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount, 'invoice_count', invoice_count) order by currency)
      from receivable_undated_rows
    ), '[]'::jsonb),
    'receivables_ageing', coalesce((
      select jsonb_agg(jsonb_build_object('currency', currency, 'age_bucket', age_bucket, 'amount', amount, 'invoice_count', invoice_count)
        order by currency, sort_order)
      from receivable_ageing_rows
    ), '[]'::jsonb),
    'delivery_performance', jsonb_build_object(
      'eligible_deliveries', (select eligible_deliveries from delivery_rows),
      'on_time_deliveries', (select on_time_deliveries from delivery_rows),
      'late_deliveries', (select late_deliveries from delivery_rows),
      'overdue_active_shipments', (select overdue_count from overdue_delivery)
    ),
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
