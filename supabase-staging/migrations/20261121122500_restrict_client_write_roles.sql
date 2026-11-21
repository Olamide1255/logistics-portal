drop policy if exists clients_insert on public.clients;
create policy clients_insert
on public.clients
for insert
to authenticated
with check (
  company_id = private.get_my_company_id()
  and private.get_my_role() in ('Customer Service', 'Freight', 'Super Admin')
);

drop policy if exists clients_update on public.clients;
create policy clients_update
on public.clients
for update
to authenticated
using (
  company_id = private.get_my_company_id()
  and private.get_my_role() = 'Super Admin'
)
with check (
  company_id = private.get_my_company_id()
  and private.get_my_role() = 'Super Admin'
);
