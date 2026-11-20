alter table public.companies
  add column if not exists admin_invite_email text,
  add column if not exists admin_invite_status text not null default 'not_sent',
  add column if not exists admin_invite_error text,
  add column if not exists admin_invited_at timestamptz;
alter table public.companies drop constraint if exists companies_admin_invite_status_check;
alter table public.companies add constraint companies_admin_invite_status_check
  check (admin_invite_status in ('not_sent', 'pending', 'sent', 'failed'));
