-- Suspended tenants must lose tenant-data access even when calling Supabase directly.
-- The dashboard already signs suspended users out; this makes RLS enforce the same boundary.
CREATE OR REPLACE FUNCTION private.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT p.company_id
  FROM public.profiles AS p
  JOIN public.companies AS c ON c.id = p.company_id
  WHERE p.id = auth.uid()
    AND c.status = 'Active'
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION private.get_my_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.get_my_company_id() TO authenticated, service_role;

COMMENT ON FUNCTION private.get_my_company_id()
IS 'Returns the authenticated user tenant only while that company is Active; suspended tenants receive NULL and fail tenant-scoped RLS checks.';
