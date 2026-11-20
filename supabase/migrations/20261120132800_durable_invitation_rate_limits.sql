create table if not exists public.rate_limit_buckets (
  identifier text primary key,
  request_count integer not null check (request_count > 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.rate_limit_buckets enable row level security;
revoke all on table public.rate_limit_buckets from public, anon, authenticated;
grant all on table public.rate_limit_buckets to service_role;
create or replace function public.consume_rate_limit(p_identifier text, p_limit integer, p_window_ms integer)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_count integer;
  v_reset_at timestamptz;
  v_now timestamptz := clock_timestamp();
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
