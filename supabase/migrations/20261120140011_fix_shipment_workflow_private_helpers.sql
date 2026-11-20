-- Fix the shipment workflow trigger after RLS helpers were moved to the private schema.
-- The old PL/pgSQL body still referenced public.get_my_role()/public.is_platform_admin(),
-- which no longer exist after the helper relocation. That breaks shipment updates at runtime.
create or replace function public.enforce_shipment_workflow()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  actor_role text := private.get_my_role();
  details_changed boolean;
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or actor_role = 'Super Admin'
     or private.is_platform_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.company_id is distinct from old.company_id
     or new.awb_number is distinct from old.awb_number
     or new.client_id is distinct from old.client_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Shipment identity and tenant ownership cannot be changed'
      using errcode = '42501';
  end if;

  details_changed :=
    (to_jsonb(new) - array['current_status', 'payment_status', 'updated_at'])
    is distinct from
    (to_jsonb(old) - array['current_status', 'payment_status', 'updated_at']);

  if details_changed and actor_role <> 'Customer Service' then
    raise exception 'Only Customer Service or an administrator can edit shipment details'
      using errcode = '42501';
  end if;

  if new.payment_status is distinct from old.payment_status and actor_role <> 'Finance' then
    raise exception 'Only Finance or an administrator can change payment status'
      using errcode = '42501';
  end if;

  if old.current_status is not distinct from new.current_status then
    return new;
  end if;

  if old.current_status = 'Registered' and new.current_status = 'Booked' and actor_role = 'Freight' then
    return new;
  end if;
  if old.current_status = 'Booked' and new.current_status = 'Picked Up' and actor_role = 'RFS' then
    return new;
  end if;
  if old.current_status = 'Picked Up' and new.current_status in ('Delivered', 'Handed to Ops') and actor_role = 'RFS' then
    return new;
  end if;
  if old.current_status = 'Handed to Ops' and new.current_status in ('Export Cleared', 'Handed to Airline') and actor_role = 'Operations' then
    return new;
  end if;
  if old.current_status = 'Export Cleared' and new.current_status = 'Handed to Airline' and actor_role = 'Operations' then
    return new;
  end if;

  raise exception 'Role % cannot transition shipment from % to %. Follow the assigned operational workflow.',
    coalesce(actor_role, 'Unknown'), old.current_status, new.current_status
    using errcode = '42501';
end;
$$;
