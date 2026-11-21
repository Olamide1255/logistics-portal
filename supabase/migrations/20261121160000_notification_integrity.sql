create or replace function private.enforce_notification_integrity()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public, private
as $function$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid;
  actor_role text;
  actor_company_status text;
  canonical_awb text;
begin
  -- Trusted backend jobs may write notifications without a user session.
  if actor_id is null then
    if current_setting('request.jwt.claim.role', true) = 'service_role' then
      return new;
    end if;
    raise exception 'Notifications require an authenticated actor'
      using errcode = '42501';
  end if;

  select p.company_id, p.role, c.status
    into actor_company_id, actor_role, actor_company_status
  from public.profiles p
  join public.companies c on c.id = p.company_id
  where p.id = actor_id
    and p.is_platform_admin is distinct from true;

  if actor_company_id is null
     or actor_role is null
     or actor_company_status is distinct from 'Active' then
    raise exception 'An active tenant profile is required to create notifications'
      using errcode = '42501';
  end if;

  if new.role_target is null
     or new.role_target not in (
       'ALL',
       'Customer Service',
       'Finance',
       'Freight',
       'Operations',
       'RFS',
       'Super Admin'
     ) then
    raise exception 'Notification recipient role is invalid'
      using errcode = '22023';
  end if;

  new.title := btrim(coalesce(new.title, ''));
  new.message := btrim(coalesce(new.message, ''));

  if length(new.title) < 1 or length(new.title) > 120
     or length(new.message) < 1 or length(new.message) > 1000 then
    raise exception 'Notification title and message must be within the allowed length'
      using errcode = '22001';
  end if;

  if new.shipment_awb is not null then
    new.shipment_awb := nullif(btrim(new.shipment_awb), '');
    if new.shipment_awb is not null then
      select s.awb_number
        into canonical_awb
      from public.shipments s
      where s.company_id = actor_company_id
        and s.awb_number = new.shipment_awb
      limit 1;

      if canonical_awb is null then
        raise exception 'The referenced shipment does not belong to the authenticated company'
          using errcode = '42501';
      end if;

      new.shipment_awb := canonical_awb;
    end if;
  end if;

  -- Never trust tenant-supplied ownership, read-state, or timestamps.
  new.company_id := actor_company_id;
  new.is_read := false;
  new.created_at := now();
  return new;
end;
$function$;

revoke all on function private.enforce_notification_integrity() from public, anon, authenticated;

drop trigger if exists enforce_notification_integrity on public.notifications;
create trigger enforce_notification_integrity
before insert on public.notifications
for each row
execute function private.enforce_notification_integrity();
