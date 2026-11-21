create or replace function public.get_platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path to pg_catalog, public, private
as $function$
declare
  result jsonb;
begin
  if not private.is_platform_admin() then
    raise exception 'Only a Platform Administrator can view platform-wide tenant health'
      using errcode = '42501';
  end if;

  with user_counts as (
    select p.company_id, count(*)::bigint as user_count, max(p.created_at) as last_user_at
    from public.profiles p
    where p.company_id is not null
    group by p.company_id
  ),
  shipment_counts as (
    select
      s.company_id,
      count(*)::bigint as shipment_count,
      count(*) filter (where s.current_status is distinct from 'Delivered')::bigint as active_shipment_count,
      count(*) filter (where s.current_status = 'Delivered')::bigint as delivered_shipment_count,
      max(s.created_at) as last_shipment_at
    from public.shipments s
    group by s.company_id
  ),
  tenant_rows as (
    select
      c.id,
      c.name,
      c.status,
      c.subscription_tier,
      c.admin_invite_email,
      c.admin_invite_status,
      c.admin_invite_error,
      c.admin_invited_at,
      c.created_at,
      coalesce(uc.user_count, 0) as user_count,
      coalesce(sc.shipment_count, 0) as shipment_count,
      coalesce(sc.active_shipment_count, 0) as active_shipment_count,
      coalesce(sc.delivered_shipment_count, 0) as delivered_shipment_count,
      greatest(uc.last_user_at, sc.last_shipment_at) as last_activity_at
    from public.companies c
    left join user_counts uc on uc.company_id = c.id
    left join shipment_counts sc on sc.company_id = c.id
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'total_companies', (select count(*) from tenant_rows),
      'active_companies', (select count(*) from tenant_rows where status = 'Active'),
      'suspended_companies', (select count(*) from tenant_rows where status is distinct from 'Active'),
      'total_users', (select coalesce(sum(user_count), 0) from tenant_rows),
      'total_shipments', (select coalesce(sum(shipment_count), 0) from tenant_rows),
      'active_shipments', (select coalesce(sum(active_shipment_count), 0) from tenant_rows),
      'delivered_shipments', (select coalesce(sum(delivered_shipment_count), 0) from tenant_rows),
      'failed_admin_invites', (select count(*) from tenant_rows where admin_invite_status = 'failed'),
      'pending_admin_invites', (select count(*) from tenant_rows where admin_invite_status = 'pending')
    ),
    'companies', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'status', t.status,
          'subscription_tier', t.subscription_tier,
          'admin_invite_email', t.admin_invite_email,
          'admin_invite_status', t.admin_invite_status,
          'admin_invite_error', t.admin_invite_error,
          'admin_invited_at', t.admin_invited_at,
          'created_at', t.created_at,
          'user_count', t.user_count,
          'shipment_count', t.shipment_count,
          'active_shipment_count', t.active_shipment_count,
          'delivered_shipment_count', t.delivered_shipment_count,
          'last_activity_at', t.last_activity_at
        )
        order by t.created_at desc, t.name
      )
      from tenant_rows t
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$function$;

revoke all on function public.get_platform_overview() from public, anon;
grant execute on function public.get_platform_overview() to authenticated;
