create or replace function private.enforce_payment_ledger_integrity()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public, private
as $function$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid;
  actor_role text;
  actor_email text;
  shipment_company_id uuid;
  shipment_currency text;
begin
  if actor_id is null then
    if current_setting('request.jwt.claim.role', true) = 'service_role' then
      return new;
    end if;
    raise exception 'Payment records require an authenticated actor'
      using errcode = '42501';
  end if;

  actor_company_id := private.get_my_company_id();
  actor_role := private.get_my_role();

  if actor_company_id is null
     or actor_role is null
     or actor_role not in ('Finance', 'Super Admin') then
    raise exception 'Only Finance or Super Admin users in an active company can record payments'
      using errcode = '42501';
  end if;

  select p.email into actor_email
  from public.profiles p
  where p.id = actor_id and p.company_id = actor_company_id;

  if nullif(btrim(actor_email), '') is null then
    raise exception 'An active company profile is required to record payments'
      using errcode = '42501';
  end if;

  if new.shipment_id is null then
    raise exception 'A shipment is required for this payment'
      using errcode = '23502';
  end if;

  select s.company_id,
         upper(coalesce(nullif(btrim(s.currency), ''), 'NGN'))
    into shipment_company_id, shipment_currency
  from public.shipments s
  where s.id = new.shipment_id;

  if not found or shipment_company_id is distinct from actor_company_id then
    raise exception 'The shipment does not belong to the authenticated actor company'
      using errcode = '42501';
  end if;

  if new.amount is null or new.amount <= 0
     or new.amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Payment amount must be greater than zero'
      using errcode = '22023';
  end if;

  new.currency := upper(coalesce(nullif(btrim(new.currency), ''), shipment_currency));
  if new.currency !~ '^[A-Z]{3}$' then
    raise exception 'Payment currency must be a valid three-letter currency code'
      using errcode = '22023';
  end if;

  if new.currency <> shipment_currency then
    raise exception 'Payment currency must match the shipment currency'
      using errcode = '22023';
  end if;

  if new.reference is not null and length(new.reference) > 255 then
    raise exception 'Payment reference cannot exceed 255 characters'
      using errcode = '22001';
  end if;

  new.company_id := actor_company_id;
  new.recorded_by := actor_email;
  new.created_at := now();
  return new;
end;
$function$;

revoke all on function private.enforce_payment_ledger_integrity() from public, anon, authenticated;
drop trigger if exists enforce_payment_ledger_integrity_trigger on public.payments;
create trigger enforce_payment_ledger_integrity_trigger
before insert on public.payments
for each row execute function private.enforce_payment_ledger_integrity();