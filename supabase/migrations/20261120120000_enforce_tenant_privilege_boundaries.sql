-- Prevent tenant administrators from escalating account or subscription privileges.
-- This migration is intentionally additive and does not rewrite existing company/user data.

CREATE OR REPLACE FUNCTION public.enforce_profile_privilege_boundaries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Trusted backend/service-role operations remain able to provision accounts.
  IF auth.role() = 'service_role' OR session_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- Only an existing Platform Admin may change tenant assignment or platform-admin status.
  IF NOT public.is_platform_admin() THEN
    IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'Only a Platform Admin can change a user's company assignment'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin THEN
      RAISE EXCEPTION 'Only a Platform Admin can change platform administrator status'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role AND NEW.role = 'Super Admin' THEN
      RAISE EXCEPTION 'Only a Platform Admin can assign the Super Admin role'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_privilege_boundaries ON public.profiles;
CREATE TRIGGER enforce_profile_privilege_boundaries
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_privilege_boundaries();

CREATE OR REPLACE FUNCTION public.enforce_company_billing_boundaries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR session_user IN ('postgres', 'supabase_admin') OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only a Platform Admin can change company status'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    RAISE EXCEPTION 'Only a Platform Admin can change a company's subscription tier'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_company_billing_boundaries ON public.companies;
CREATE TRIGGER enforce_company_billing_boundaries
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.enforce_company_billing_boundaries();

-- RLS does not protect against TRUNCATE. No browser client requires these privileges.
REVOKE TRUNCATE, REFERENCES, TRIGGER
ON TABLE
  public.audit_logs,
  public.clients,
  public.companies,
  public.notifications,
  public.payments,
  public.profiles,
  public.shipment_comments,
  public.shipment_documents,
  public.shipment_timeline,
  public.shipments
FROM anon, authenticated;

-- Do not expose trigger-function execution as a callable RPC.
REVOKE ALL ON FUNCTION public.enforce_profile_privilege_boundaries() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_company_billing_boundaries() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.enforce_profile_privilege_boundaries()
IS 'Prevents tenant-level users from changing company assignment or platform-admin privileges.';

COMMENT ON FUNCTION public.enforce_company_billing_boundaries()
IS 'Prevents tenant-level users from changing company status or subscription tier.';
