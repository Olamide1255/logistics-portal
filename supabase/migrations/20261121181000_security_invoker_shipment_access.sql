-- Replace the owner-privileged shipment view with an invoker view.
-- Tenant RLS is now enforced as the querying role; financial values are
-- returned only through a narrowly scoped, role-checked RPC.

create or replace view public.shipments_secure
with (security_invoker = true, security_barrier = true)
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
  null::numeric as rate,
  null::numeric as agreed_amount,
  s.expected_delivery_date,
  s.payment_due_date,
  s.delivered_at,
  s.tracking_token
from public.shipments s
where private.is_platform_admin()
   or s.company_id = private.get_my_company_id();

alter view public.shipments_secure
  set (security_invoker = true, security_barrier = true);

grant select on public.shipments_secure to authenticated;

-- The view only needs tenant-safe columns. The opaque tracking token is
-- tenant-scoped by the shipments RLS policy; financial columns remain denied.
grant select (tracking_token) on public.shipments to authenticated;
revoke select (rate, agreed_amount) on public.shipments from authenticated;

-- Keep finance values available to the same roles that were allowed by the
-- former view, but enforce identity, active-tenant scope and role in the DB.
create or replace function private.get_shipment_financials_impl(p_shipment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to pg_catalog, public, private
set row_security = off
as $function$
declare
  result jsonb;
  actor_role text := private.get_my_role();
  actor_company_id uuid := private.get_my_company_id();
  platform_admin boolean := private.is_platform_admin();
begin
  if auth.uid() is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if coalesce(actor_role, '') not in (
    'Super Admin', 'Customer Service', 'Finance', 'Freight', 'Platform Admin'
  ) then
    raise exception 'Insufficient permissions to view shipment financial details'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'rate', s.rate,
    'agreed_amount', s.agreed_amount,
    'currency', s.currency
  )
  into result
  from public.shipments s
  where s.id = p_shipment_id
    and (
      platform_admin
      or (actor_company_id is not null and s.company_id = actor_company_id)
    )
  limit 1;

  return result;
end;
$function$;

revoke all on function private.get_shipment_financials_impl(uuid) from public, anon;
grant execute on function private.get_shipment_financials_impl(uuid) to authenticated;

create or replace function public.get_shipment_financials(p_shipment_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path to pg_catalog, private
as $function$
  select private.get_shipment_financials_impl(p_shipment_id);
$function$;

revoke all on function public.get_shipment_financials(uuid) from public, anon;
grant execute on function public.get_shipment_financials(uuid) to authenticated;

-- Move privileged reporting implementations into the non-exposed private
-- schema. Public RPC names remain as SECURITY INVOKER wrappers, while the
-- private implementations retain their explicit authorization checks.
alter function public.get_client_report_page(text, integer, integer) set schema private;
alter function private.get_client_report_page(text, integer, integer) rename to get_client_report_page_impl;
revoke all on function private.get_client_report_page_impl(text, integer, integer) from public, anon;
grant execute on function private.get_client_report_page_impl(text, integer, integer) to authenticated;

create or replace function public.get_client_report_page(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path to pg_catalog, private
as $function$
  select private.get_client_report_page_impl(p_search, p_limit, p_offset);
$function$;
revoke all on function public.get_client_report_page(text, integer, integer) from public, anon;
grant execute on function public.get_client_report_page(text, integer, integer) to authenticated;

alter function public.get_operations_report(date, date) set schema private;
alter function private.get_operations_report(date, date) rename to get_operations_report_impl;
revoke all on function private.get_operations_report_impl(date, date) from public, anon;
grant execute on function private.get_operations_report_impl(date, date) to authenticated;

create or replace function public.get_operations_report(
  p_start_date date default (timezone('Africa/Lagos', now())::date - 29),
  p_end_date date default timezone('Africa/Lagos', now())::date
)
returns jsonb
language sql
stable
security invoker
set search_path to pg_catalog, private
as $function$
  select private.get_operations_report_impl(p_start_date, p_end_date);
$function$;
revoke all on function public.get_operations_report(date, date) from public, anon;
grant execute on function public.get_operations_report(date, date) to authenticated;

alter function public.get_platform_overview() set schema private;
alter function private.get_platform_overview() rename to get_platform_overview_impl;
revoke all on function private.get_platform_overview_impl() from public, anon;
grant execute on function private.get_platform_overview_impl() to authenticated;

create or replace function public.get_platform_overview()
returns jsonb
language sql
stable
security invoker
set search_path to pg_catalog, private
as $function$
  select private.get_platform_overview_impl();
$function$;
revoke all on function public.get_platform_overview() from public, anon;
grant execute on function public.get_platform_overview() to authenticated;

-- Public tracking remains anonymous by design, but its SECURITY DEFINER
-- implementation is kept out of the exposed public schema.
alter function public.get_public_shipment_tracking(text) set schema private;
alter function private.get_public_shipment_tracking(text) rename to get_public_shipment_tracking_impl;
revoke all on function private.get_public_shipment_tracking_impl(text) from public, authenticated;
grant usage on schema private to anon;
grant execute on function private.get_public_shipment_tracking_impl(text) to anon;

create or replace function public.get_public_shipment_tracking(p_token text)
returns jsonb
language sql
stable
security invoker
set search_path to pg_catalog, private
as $function$
  select private.get_public_shipment_tracking_impl(p_token);
$function$;
revoke all on function public.get_public_shipment_tracking(text) from public, authenticated;
grant execute on function public.get_public_shipment_tracking(text) to anon;
