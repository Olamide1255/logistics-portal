-- The secure shipment view is a read model only. Its columns are intentionally
-- shaped for tenant-safe reads; all writes must go through the base table so
-- the base-table RLS policies and workflow triggers remain the only write path.
revoke all privileges on table public.shipments_secure from public, anon, authenticated;
grant select on table public.shipments_secure to authenticated;
