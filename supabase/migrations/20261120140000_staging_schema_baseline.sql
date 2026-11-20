-- Reproducible, data-free baseline for Logistics Portal staging.
-- This is a schema snapshot of the production application schema as of 2026-11-20.
-- It intentionally excludes tenant records, Auth users, secrets, production webhooks,
-- and all Storage objects. Managed Supabase schemas (auth/storage) are not recreated.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- Core tenant tables.
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  status text default 'Active',
  created_at timestamptz not null default timezone('utc', now()),
  email text,
  phone text,
  address text,
  subscription_tier text default 'Basic',
  admin_invite_email text,
  admin_invite_status text not null default 'not_sent'
    check (admin_invite_status in ('not_sent','pending','sent','failed')),
  admin_invite_error text,
  admin_invited_at timestamptz
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text default 'Unknown',
  updated_at timestamptz default timezone('utc', now()),
  company_id uuid references public.companies(id) on delete cascade,
  is_platform_admin boolean default false,
  department text default 'Unassigned',
  sound_alerts boolean default true,
  push_notifications boolean default true,
  constraint profiles_tenant_assignment_check check (
    (is_platform_admin is true and company_id is null)
    or (is_platform_admin is distinct from true and company_id is not null)
  )
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  contact_person text,
  phone_number text,
  email text,
  created_at timestamptz not null default timezone('utc', now()),
  company_id uuid not null references public.companies(id) on delete cascade,
  constraint clients_id_company_unique unique (id, company_id)
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  awb_number text not null unique,
  client_id uuid references public.clients(id),
  sender_details text not null,
  receiver_details text not null,
  weight numeric,
  dimensions text,
  origin text,
  destination text,
  commodity_type text,
  payment_status text default 'Pending',
  current_status text default 'Registered',
  created_at timestamptz not null default timezone('utc', now()),
  shipment_type text default 'Export',
  service_type text default 'DDP',
  agreed_amount numeric,
  currency text default 'NGN',
  rate numeric,
  company_id uuid not null references public.companies(id) on delete cascade,
  constraint shipments_id_company_unique unique (id, company_id),
  constraint shipments_client_company_fkey
    foreign key (client_id, company_id)
    references public.clients(id, company_id) on delete restrict
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  amount numeric not null,
  currency text default 'NGN',
  payment_method text,
  reference text,
  recorded_by text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint payments_shipment_company_fkey
    foreign key (shipment_id, company_id)
    references public.shipments(id, company_id) on delete cascade
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  role_target text not null,
  title text not null,
  message text not null,
  is_read boolean default false,
  shipment_awb text,
  created_at timestamptz not null default timezone('utc', now()),
  company_id uuid not null
    references public.companies(id) on delete cascade
);

create table public.shipment_comments (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid references public.shipments(id) on delete cascade,
  comment_text text not null,
  updated_by_role text not null,
  action_by_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  company_id uuid not null default private.get_my_company_id()
    references public.companies(id) on delete cascade,
  constraint shipment_comments_shipment_company_fkey
    foreign key (shipment_id, company_id)
    references public.shipments(id, company_id) on delete cascade
);

create table public.shipment_documents (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid references public.shipments(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  uploaded_by text not null,
  created_at timestamptz not null default timezone('utc', now()),
  company_id uuid not null references public.companies(id) on delete cascade,
  file_path text,
  constraint shipment_documents_shipment_company_fkey
    foreign key (shipment_id, company_id)
    references public.shipments(id, company_id)
);

create table public.shipment_timeline (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid references public.shipments(id) on delete cascade,
  status_dropdown text not null,
  status_notes text,
  updated_by_role text not null,
  action_by_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  company_id uuid not null default private.get_my_company_id()
    references public.companies(id) on delete cascade,
  constraint shipment_timeline_shipment_company_fkey
    foreign key (shipment_id, company_id)
    references public.shipments(id, company_id) on delete cascade
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  user_email text,
  action text not null,
  details text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.rate_limit_buckets (
  identifier text primary key,
  request_count integer not null check (request_count > 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- Tenant lookup and child-row indexes.
create index idx_audit_logs_company_id on public.audit_logs(company_id);
create index idx_clients_company_id on public.clients(company_id);
create index idx_notifications_company_id on public.notifications(company_id);
create index idx_payments_company_id on public.payments(company_id);
create index idx_payments_shipment_id on public.payments(shipment_id);
create index idx_payments_shipment_company on public.payments(shipment_id, company_id);
create index idx_profiles_company_id on public.profiles(company_id);
create index idx_shipment_comments_company_id on public.shipment_comments(company_id);
create index idx_shipment_comments_shipment_id on public.shipment_comments(shipment_id);
create index idx_shipment_comments_shipment_company on public.shipment_comments(shipment_id, company_id);
create index idx_shipment_documents_company_id on public.shipment_documents(company_id);
create index idx_shipment_documents_shipment_id on public.shipment_documents(shipment_id);
create index idx_shipment_documents_shipment_company on public.shipment_documents(shipment_id, company_id);
create index idx_shipment_timeline_company_id on public.shipment_timeline(company_id);
create index idx_shipment_timeline_shipment_id on public.shipment_timeline(shipment_id);
create index idx_shipment_timeline_shipment_company on public.shipment_timeline(shipment_id, company_id);
create index idx_shipments_awb on public.shipments(awb_number);
create index idx_shipments_client_id on public.shipments(client_id);
create index idx_shipments_client_company on public.shipments(client_id, company_id);
create index idx_shipments_company_id on public.shipments(company_id);
create index idx_shipments_created_at on public.shipments(created_at desc);

-- Private RLS helper functions. The private schema is not exposed as a REST schema.
create or replace function private.get_my_company_id()
returns uuid language sql stable security definer
set search_path = pg_catalog, public
as $$ select company_id from public.profiles where id = auth.uid() $$;

create or replace function private.get_my_role()
returns text language sql stable security definer
set search_path = pg_catalog, public
as $$ select role from public.profiles where id = auth.uid() limit 1 $$;

create or replace function private.is_platform_admin()
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$ select coalesce((select is_platform_admin from public.profiles where id = auth.uid()), false) $$;

revoke all on function private.get_my_company_id() from public, anon;
revoke all on function private.get_my_role() from public, anon;
revoke all on function private.is_platform_admin() from public, anon;
grant execute on function private.get_my_company_id() to authenticated, service_role;
grant execute on function private.get_my_role() to authenticated, service_role;
grant execute on function private.is_platform_admin() to authenticated, service_role;

alter table public.notifications alter column company_id set default private.get_my_company_id();
alter table public.shipment_comments alter column company_id set default private.get_my_company_id();
alter table public.shipment_timeline alter column company_id set default private.get_my_company_id();

create or replace function public.consume_rate_limit(p_identifier text, p_limit integer, p_window_ms integer)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_count integer; v_reset_at timestamptz; v_now timestamptz := clock_timestamp();
begin
  if p_identifier is null or length(p_identifier) < 1 or length(p_identifier) > 512
     or p_limit < 1 or p_limit > 10000
     or p_window_ms < 1000 or p_window_ms > 2592000000 then
    raise exception 'Invalid rate limit parameters';
  end if;
  insert into public.rate_limit_buckets(identifier, request_count, reset_at, updated_at)
  values (p_identifier, 1, v_now + make_interval(secs => p_window_ms / 1000.0), v_now)
  on conflict (identifier) do update
    set request_count = case when public.rate_limit_buckets.reset_at <= v_now then 1 else public.rate_limit_buckets.request_count + 1 end,
        reset_at = case when public.rate_limit_buckets.reset_at <= v_now then v_now + make_interval(secs => p_window_ms / 1000.0) else public.rate_limit_buckets.reset_at end,
        updated_at = v_now
  returning request_count, reset_at into v_count, v_reset_at;
  return jsonb_build_object('success', v_count <= p_limit, 'remaining', greatest(p_limit - v_count, 0),
    'retryAfterMs', greatest(0, (extract(epoch from (v_reset_at - v_now)) * 1000)::bigint));
end;
$$;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

create or replace function public.enforce_company_billing_boundaries()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or session_user in ('postgres','supabase_admin')
     or private.is_platform_admin() then return new; end if;
  if new.status is distinct from old.status then
    raise exception 'Only a Platform Admin can change company status' using errcode='42501';
  end if;
  if new.subscription_tier is distinct from old.subscription_tier then
    raise exception 'Only a Platform Admin can change a company''s subscription tier' using errcode='42501';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_profile_privilege_boundaries()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or session_user in ('postgres','supabase_admin') then return new; end if;
  if new.id is distinct from old.id then
    raise exception 'A profile identity cannot be changed' using errcode='42501';
  end if;
  if not private.is_platform_admin() then
    if old.is_platform_admin is true then
      raise exception 'Tenant administrators cannot modify a Platform Admin profile' using errcode='42501';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Only a Platform Admin or trusted backend can change a profile email' using errcode='42501';
    end if;
    if new.company_id is distinct from old.company_id then
      raise exception 'Only a Platform Admin can change a user''s company assignment' using errcode='42501';
    end if;
    if new.is_platform_admin is distinct from old.is_platform_admin then
      raise exception 'Only a Platform Admin can change platform administrator status' using errcode='42501';
    end if;
    if new.role is distinct from old.role and new.role in ('Super Admin','Platform Admin') then
      raise exception 'Only a Platform Admin can assign privileged administrator roles' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;

-- Staging workflow trigger uses the relocated private helpers (not stale public references).
create or replace function public.enforce_shipment_workflow()
returns trigger language plpgsql
set search_path = pg_catalog, public, private
as $$
declare actor_role text := private.get_my_role(); details_changed boolean;
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or actor_role = 'Super Admin' or private.is_platform_admin() then return new; end if;
  if new.id is distinct from old.id
     or new.company_id is distinct from old.company_id
     or new.awb_number is distinct from old.awb_number
     or new.client_id is distinct from old.client_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Shipment identity and tenant ownership cannot be changed' using errcode='42501';
  end if;
  details_changed :=
    (to_jsonb(new) - array['current_status','payment_status','updated_at'])
    is distinct from
    (to_jsonb(old) - array['current_status','payment_status','updated_at']);
  if details_changed and actor_role <> 'Customer Service' then
    raise exception 'Only Customer Service or an administrator can edit shipment details' using errcode='42501';
  end if;
  if new.payment_status is distinct from old.payment_status and actor_role <> 'Finance' then
    raise exception 'Only Finance or an administrator can change payment status' using errcode='42501';
  end if;
  if old.current_status is not distinct from new.current_status then return new; end if;
  if old.current_status = 'Registered' and new.current_status = 'Booked' and actor_role = 'Freight' then return new; end if;
  if old.current_status = 'Booked' and new.current_status = 'Picked Up' and actor_role = 'RFS' then return new; end if;
  if old.current_status = 'Picked Up' and new.current_status in ('Delivered','Handed to Ops') and actor_role = 'RFS' then return new; end if;
  if old.current_status = 'Handed to Ops' and new.current_status in ('Export Cleared','Handed to Airline') and actor_role = 'Operations' then return new; end if;
  if old.current_status = 'Export Cleared' and new.current_status = 'Handed to Airline' and actor_role = 'Operations' then return new; end if;
  raise exception 'Role % cannot transition shipment from % to %. Follow the assigned operational workflow.',
    coalesce(actor_role,'Unknown'), old.current_status, new.current_status using errcode='42501';
end;
$$;

create or replace function public.log_profile_audit()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if old.role is distinct from new.role then
    insert into public.audit_logs(company_id,user_email,action,details)
    values (new.company_id,auth.jwt()->>'email','Changed Role','Changed role for '||new.email||' to '||new.role);
  end if;
  return new;
end;
$$;

create or replace function public.log_shipment_audit()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_logs(company_id,user_email,action,details)
    values (old.company_id,auth.jwt()->>'email','Deleted Shipment','Deleted AWB: '||old.awb_number);
    return old;
  elsif tg_op = 'UPDATE' then
    if old.current_status is distinct from new.current_status then
      insert into public.audit_logs(company_id,user_email,action,details)
      values (new.company_id,auth.jwt()->>'email','Updated Status','AWB '||new.awb_number||' changed from '||old.current_status||' to '||new.current_status);
    end if;
    return new;
  end if;
  return null;
end;
$$;

revoke all on function public.enforce_company_billing_boundaries() from public, anon, authenticated;
revoke all on function public.enforce_profile_privilege_boundaries() from public, anon, authenticated;
revoke all on function public.enforce_shipment_workflow() from public, anon, authenticated;
revoke all on function public.log_profile_audit() from public, anon, authenticated;
revoke all on function public.log_shipment_audit() from public, anon, authenticated;

create trigger enforce_company_billing_boundaries before update on public.companies
for each row execute function public.enforce_company_billing_boundaries();
create trigger enforce_profile_privilege_boundaries before update on public.profiles
for each row execute function public.enforce_profile_privilege_boundaries();
create trigger profile_audit_trigger after update on public.profiles
for each row execute function public.log_profile_audit();
create trigger enforce_workflow_trigger before update on public.shipments
for each row execute function public.enforce_shipment_workflow();
create trigger shipment_audit_trigger after delete or update on public.shipments
for each row execute function public.log_shipment_audit();

-- No production notification HTTP trigger is copied into staging.
create view public.shipments_secure with (security_invoker = true) as
select id,company_id,awb_number,client_id,shipment_type,service_type,sender_details,receiver_details,
       weight,dimensions,origin,destination,commodity_type,current_status,payment_status,created_at,currency,
       case when private.get_my_role() = any(array['Super Admin','Customer Service','Finance','Freight','Platform Admin']) then rate else null::numeric end as rate,
       case when private.get_my_role() = any(array['Super Admin','Customer Service','Finance','Freight','Platform Admin']) then agreed_amount else null::numeric end as agreed_amount
from public.shipments;

-- RLS policies (same tenant boundaries as production).
alter table public.audit_logs enable row level security;
alter table public.clients enable row level security;
alter table public.companies enable row level security;
alter table public.notifications enable row level security;
alter table public.payments enable row level security;
alter table public.profiles enable row level security;
alter table public.rate_limit_buckets enable row level security;
alter table public.shipment_comments enable row level security;
alter table public.shipment_documents enable row level security;
alter table public.shipment_timeline enable row level security;
alter table public.shipments enable row level security;

create policy audit_select_admin on public.audit_logs for select to authenticated using (
  company_id = private.get_my_company_id() and private.get_my_role() = any(array['Super Admin','Platform Admin'])
);
create policy clients_delete on public.clients for delete to authenticated using (
  company_id = private.get_my_company_id() and private.get_my_role() = 'Super Admin'
);
create policy clients_insert on public.clients for insert to authenticated with check (company_id = private.get_my_company_id());
create policy clients_select on public.clients for select to authenticated using (company_id = private.get_my_company_id());
create policy clients_update on public.clients for update to authenticated using (company_id = private.get_my_company_id());
create policy companies_delete_platform_admin on public.companies for delete to authenticated using (private.is_platform_admin());
create policy companies_insert_platform_admin on public.companies for insert to authenticated with check (private.is_platform_admin());
create policy companies_select on public.companies for select to authenticated using (
  id = private.get_my_company_id() or private.is_platform_admin()
);
create policy companies_update on public.companies for update to authenticated
using (private.is_platform_admin() or (id = private.get_my_company_id() and private.get_my_role() = any(array['Super Admin','Platform Admin'])))
with check (private.is_platform_admin() or (id = private.get_my_company_id() and private.get_my_role() = any(array['Super Admin','Platform Admin'])));
create policy notifications_insert on public.notifications for insert to authenticated with check (company_id = private.get_my_company_id());
create policy notifications_select on public.notifications for select to authenticated using (company_id = private.get_my_company_id());
create policy notifications_update on public.notifications for update to authenticated using (company_id = private.get_my_company_id());
create policy payments_insert on public.payments for insert to authenticated with check (
  company_id = private.get_my_company_id() and private.get_my_role() = any(array['Super Admin','Finance','Platform Admin'])
);
create policy payments_select on public.payments for select to authenticated using (
  private.is_platform_admin() or (company_id = private.get_my_company_id() and private.get_my_role() = any(array['Super Admin','Customer Service','Finance','Freight','Platform Admin']))
);
create policy profiles_delete_platform_admin on public.profiles for delete to authenticated using (private.is_platform_admin());
create policy profiles_insert_platform_admin on public.profiles for insert to authenticated with check (private.is_platform_admin());
create policy profiles_select_scoped on public.profiles for select to authenticated using (
  private.is_platform_admin() or company_id = private.get_my_company_id() or id = auth.uid()
);
create policy profiles_update_admin on public.profiles for update to authenticated
using (private.is_platform_admin() or (company_id = private.get_my_company_id() and private.get_my_role() = any(array['Super Admin','Platform Admin'])))
with check (private.is_platform_admin() or (company_id = private.get_my_company_id() and private.get_my_role() = any(array['Super Admin','Platform Admin'])));
create policy rate_limit_service_role_only on public.rate_limit_buckets for all to service_role using (true) with check (true);
create policy comments_insert on public.shipment_comments for insert to authenticated with check (company_id = private.get_my_company_id());
create policy comments_select on public.shipment_comments for select to authenticated using (company_id = private.get_my_company_id());
create policy docs_delete_platform_only on public.shipment_documents for delete to authenticated using (private.is_platform_admin());
create policy docs_insert on public.shipment_documents for insert to authenticated with check (company_id = private.get_my_company_id());
create policy docs_select on public.shipment_documents for select to authenticated using (company_id = private.get_my_company_id());
create policy timeline_insert on public.shipment_timeline for insert to authenticated with check (company_id = private.get_my_company_id());
create policy timeline_select on public.shipment_timeline for select to authenticated using (company_id = private.get_my_company_id());
create policy shipments_delete on public.shipments for delete to authenticated using (
  company_id = private.get_my_company_id() and private.get_my_role() = any(array['Super Admin','Customer Service'])
);
create policy shipments_insert on public.shipments for insert to authenticated with check (
  company_id = private.get_my_company_id() and (private.get_my_role() = any(array['Super Admin','Customer Service','Freight']) or private.is_platform_admin())
);
create policy shipments_select on public.shipments for select to authenticated using (
  private.is_platform_admin() or company_id = private.get_my_company_id()
);
create policy shipments_update on public.shipments for update to authenticated using (company_id = private.get_my_company_id());

-- Browser users have no anonymous access to business tables. RLS remains the row boundary.
grant select,insert,update,delete on public.audit_logs,public.clients,public.companies,public.notifications,
  public.payments,public.profiles,public.shipment_comments,public.shipment_documents,
  public.shipment_timeline,public.shipments to authenticated;
grant all on public.audit_logs,public.clients,public.companies,public.notifications,public.payments,
  public.profiles,public.rate_limit_buckets,public.shipment_comments,public.shipment_documents,
  public.shipment_timeline,public.shipments to service_role;
grant select on public.shipments_secure to authenticated,service_role;
revoke all on public.audit_logs,public.clients,public.companies,public.notifications,public.payments,
  public.profiles,public.shipment_comments,public.shipment_documents,public.shipment_timeline,
  public.shipments,public.shipments_secure from anon;
revoke truncate,references,trigger on public.audit_logs,public.clients,public.companies,public.notifications,
  public.payments,public.profiles,public.shipment_comments,public.shipment_documents,
  public.shipment_timeline,public.shipments from anon,authenticated;
revoke insert on public.audit_logs from anon,authenticated;
revoke all on public.rate_limit_buckets from public,anon,authenticated;
grant all on public.rate_limit_buckets to service_role;

-- Private shipment document bucket, with staging-specific empty storage.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('shipment-documents','shipment-documents',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy storage_delete_platform_only on storage.objects for delete to authenticated using (
  bucket_id = 'shipment-documents' and private.is_platform_admin()
);
create policy storage_insert_own_company on storage.objects for insert to authenticated with check (
  bucket_id = 'shipment-documents' and (storage.foldername(name))[1] = private.get_my_company_id()::text
);
create policy storage_select_own_company on storage.objects for select to authenticated using (
  bucket_id = 'shipment-documents' and (storage.foldername(name))[1] = private.get_my_company_id()::text
);

comment on schema private is 'Non-PostgREST schema for tenant-scoped RLS helper functions.';
comment on table public.rate_limit_buckets is 'Server-only persistent rate-limit state; no browser access.';
