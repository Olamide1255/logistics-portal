create or replace function private.get_my_company_status()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select c.status
  from public.profiles as p
  join public.companies as c
    on c.id = p.company_id
  where p.id = (select auth.uid())
    and p.company_id is not null
  limit 1;
$function$;

revoke all on function private.get_my_company_status() from public, anon;
grant execute on function private.get_my_company_status() to authenticated;

create or replace function public.get_my_company_status()
returns text
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $function$
  select private.get_my_company_status();
$function$;

revoke all on function public.get_my_company_status() from public, anon;
grant execute on function public.get_my_company_status() to authenticated;
