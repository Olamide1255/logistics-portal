revoke all on function public.get_my_company_id() from public, anon;
revoke all on function public.get_my_role() from public, anon;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.get_my_company_id() to authenticated, service_role;
grant execute on function public.get_my_role() to authenticated, service_role;
grant execute on function public.is_platform_admin() to authenticated, service_role;
comment on function public.get_my_company_id() is
  'RLS helper: returns only the company_id belonging to auth.uid(); authenticated execution is required by tenant policies.';
comment on function public.get_my_role() is
  'RLS helper: returns only the role belonging to auth.uid(); authenticated execution is required by tenant policies.';
comment on function public.is_platform_admin() is
  'RLS helper: returns only the platform-admin boolean belonging to auth.uid(); authenticated execution is required by platform policies.';
