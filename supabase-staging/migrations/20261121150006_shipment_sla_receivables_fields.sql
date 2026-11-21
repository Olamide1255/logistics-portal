alter table public.shipments
  add column if not exists expected_delivery_date date,
  add column if not exists payment_due_date date,
  add column if not exists delivered_at timestamptz;

comment on column public.shipments.expected_delivery_date is
  'Planned delivery date used for SLA and late-delivery reporting; null means no commitment was recorded.';
comment on column public.shipments.payment_due_date is
  'Agreed payment due date used for receivables ageing; null means no due date was recorded.';
comment on column public.shipments.delivered_at is
  'Database timestamp for the first transition to Delivered; historical rows remain null when the actual event time is unknown.';

create index if not exists idx_shipments_company_expected_delivery
  on public.shipments (company_id, expected_delivery_date)
  where expected_delivery_date is not null and current_status is distinct from 'Delivered';

create index if not exists idx_shipments_company_payment_due
  on public.shipments (company_id, payment_due_date)
  where payment_due_date is not null;

create index if not exists idx_shipments_company_delivered_at
  on public.shipments (company_id, delivered_at)
  where delivered_at is not null;

create or replace function private.capture_first_delivery_timestamp()
returns trigger
language plpgsql
security invoker
set search_path to pg_catalog, public, private
as $function$
begin
  if tg_op = 'INSERT' then
    if new.current_status = 'Delivered' then
      new.delivered_at := coalesce(new.delivered_at, now());
    else
      new.delivered_at := null;
    end if;
    return new;
  end if;

  if old.delivered_at is not null then
    new.delivered_at := old.delivered_at;
  elsif old.current_status is distinct from 'Delivered'
        and new.current_status = 'Delivered' then
    new.delivered_at := now();
  else
    new.delivered_at := null;
  end if;

  return new;
end;
$function$;

revoke all on function private.capture_first_delivery_timestamp() from public, anon, authenticated;

drop trigger if exists capture_first_delivery_timestamp_trigger on public.shipments;
create trigger capture_first_delivery_timestamp_trigger
before insert or update of current_status, delivered_at
on public.shipments
for each row
execute function private.capture_first_delivery_timestamp();