-- Avoid evaluating auth.uid() once per profile row.
drop policy if exists profiles_select_scoped on public.profiles;
create policy profiles_select_scoped
on public.profiles
for select
to authenticated
using (
  (select private.is_platform_admin())
  or company_id = (select private.get_my_company_id())
  or id = (select auth.uid())
);
