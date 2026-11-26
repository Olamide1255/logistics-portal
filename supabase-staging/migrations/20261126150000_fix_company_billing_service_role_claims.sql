CREATE OR REPLACE FUNCTION public.enforce_company_billing_boundaries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );

  IF jwt_role = 'service_role'
     OR session_user IN ('postgres', 'supabase_admin')
     OR private.is_platform_admin()
  THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only a Platform Admin can change company status'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    RAISE EXCEPTION 'Only a Platform Admin can change a company''s subscription tier'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
