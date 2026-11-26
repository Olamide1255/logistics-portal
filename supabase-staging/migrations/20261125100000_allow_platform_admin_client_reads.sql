-- Keep client records tenant-scoped.
-- Platform-wide reporting uses the dedicated platform overview RPC.
DROP POLICY IF EXISTS clients_select ON public.clients;

CREATE POLICY clients_select
ON public.clients
FOR SELECT
TO authenticated
USING (
  company_id = (SELECT private.get_my_company_id())
);
