create or replace function private.enforce_shipment_timeline_integrity()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public, private
as $function$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  actor_email text;
  actor_company_id uuid;
  shipment_status text;
  shipment_payment_status text;
begin
  if actor_id is null then
    if current_setting('request.jwt.claim.role', true) = 'service_role' then
      return new;
    end if;
    raise exception 'Timeline entries require an authenticated actor'
      using errcode = '42501';
  end if;

  select p.role, p.email, p.company_id
    into actor_role, actor_email, actor_company_id
  from public.profiles p
  where p.id = actor_id;

  if actor_company_id is null
     or new.company_id is distinct from actor_company_id then
    raise exception 'Timeline entry must belong to the authenticated actor company'
      using errcode = '42501';
  end if;

  if new.shipment_id is null then
    raise exception 'A shipment is required for a timeline entry'
      using errcode = '23502';
  end if;

  select s.current_status, s.payment_status
    into shipment_status, shipment_payment_status
  from public.shipments s
  where s.id = new.shipment_id
    and s.company_id = actor_company_id;

  if not found then
    raise exception 'The shipment does not belong to the authenticated actor company'
      using errcode = '42501';
  end if;

  if new.status_dropdown = 'Details Edited' then
    if actor_role not in ('Customer Service', 'Super Admin') then
      raise exception 'Only Customer Service or a company administrator can record shipment detail edits'
        using errcode = '42501';
    end if;
  elsif new.status_dropdown = 'Finance Approved' then
    if actor_role not in ('Finance', 'Super Admin')
       or shipment_payment_status is distinct from 'Approved' then
      raise exception 'Only Finance or a company administrator can record an approved payment'
        using errcode = '42501';
    end if;
  else
    if new.status_dropdown is distinct from shipment_status then
      raise exception 'Timeline workflow status must match the shipment current status'
        using errcode = '42501';
    end if;

    if actor_role <> 'Super Admin' then
      if new.status_dropdown = 'Registered' and actor_role <> 'Customer Service' then
        raise exception 'Only Customer Service can record shipment registration'
          using errcode = '42501';
      elsif new.status_dropdown = 'Booked' and actor_role <> 'Freight' then
        raise exception 'Only Freight can record the booking milestone'
          using errcode = '42501';
      elsif new.status_dropdown in ('Picked Up', 'Delivered', 'Handed to Ops') and actor_role <> 'RFS' then
        raise exception 'Only RFS can record this shipment milestone'
          using errcode = '42501';
      elsif new.status_dropdown in ('Export Cleared', 'Handed to Airline') and actor_role <> 'Operations' then
        raise exception 'Only Operations can record this shipment milestone'
          using errcode = '42501';
      elsif new.status_dropdown not in ('Registered', 'Booked', 'Picked Up', 'Delivered', 'Handed to Ops', 'Export Cleared', 'Handed to Airline') then
        raise exception 'This timeline milestone is not supported'
          using errcode = '42501';
      end if;
    elsif new.status_dropdown not in ('Registered', 'Booked', 'Picked Up', 'Delivered', 'Handed to Ops', 'Export Cleared', 'Handed to Airline') then
      raise exception 'This timeline milestone is not supported'
        using errcode = '42501';
    end if;
  end if;

  if length(coalesce(new.status_notes, '')) > 2000 then
    raise exception 'Timeline notes must be 2000 characters or fewer'
      using errcode = '22001';
  end if;

  new.company_id := actor_company_id;
  new.updated_by_role := coalesce(actor_role, 'Unknown');
  new.action_by_name := coalesce(actor_email, 'Unknown');
  new.created_at := now();

  return new;
end;
$function$;

revoke all on function private.enforce_shipment_timeline_integrity() from public, anon, authenticated;

drop trigger if exists enforce_shipment_timeline_integrity_trigger on public.shipment_timeline;
create trigger enforce_shipment_timeline_integrity_trigger
before insert on public.shipment_timeline
for each row execute function private.enforce_shipment_timeline_integrity();
