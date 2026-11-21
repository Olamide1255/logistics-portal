create or replace function public.get_client_report_page(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
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
    raise exception 'Insufficient permissions to view client financial reports'
      using errcode = '42501';
  end if;

  with filtered_clients as (
    select c.id, c.company_id, c.client_name, c.created_at
    from public.clients c
    where p_search is null
      or c.client_name ilike '%' || left(p_search, 120) || '%'
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
