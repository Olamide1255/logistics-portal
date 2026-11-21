-- Keep tenant notifications visible only to their intended role.
-- Users may acknowledge visible notifications, but cannot rewrite notification content.

drop policy if exists notifications_select on public.notifications;
create policy notifications_select
on public.notifications
for select
to authenticated
using (
  company_id = private.get_my_company_id()
  and (role_target = 'ALL' or role_target = private.get_my_role())
);

drop policy if exists notifications_update on public.notifications;
create policy notifications_update
on public.notifications
for update
to authenticated
using (
  company_id = private.get_my_company_id()
  and (role_target = 'ALL' or role_target = private.get_my_role())
)
with check (
  company_id = private.get_my_company_id()
  and (role_target = 'ALL' or role_target = private.get_my_role())
);

-- The notification UI only needs to mark an item as read.
-- Remove broad row-level UPDATE and grant the single mutable column.
revoke update on table public.notifications from authenticated;
grant update (is_read) on table public.notifications to authenticated;
