-- Audit records, payments and shipment history are append-only/read-only for
-- authenticated clients. Notifications may only change the is_read flag.
revoke all privileges on table public.audit_logs from public, anon, authenticated;
grant select on table public.audit_logs to authenticated;

revoke all privileges on table public.notifications from public, anon, authenticated;
grant select, insert on table public.notifications to authenticated;
grant update (is_read) on table public.notifications to authenticated;

revoke all privileges on table public.payments from public, anon, authenticated;
grant select, insert on table public.payments to authenticated;

revoke all privileges on table public.shipment_comments from public, anon, authenticated;
grant select, insert on table public.shipment_comments to authenticated;

revoke all privileges on table public.shipment_documents from public, anon, authenticated;
grant select, insert, delete on table public.shipment_documents to authenticated;

revoke all privileges on table public.shipment_timeline from public, anon, authenticated;
grant select, insert on table public.shipment_timeline to authenticated;
