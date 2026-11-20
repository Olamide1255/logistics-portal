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
  IF current_setting('request.jwt.claim.role', true) = 'service_role' OR session_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'A profile identity cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  -- Only an existing Platform Admin may change tenant assignment or platform-admin status.
  IF NOT public.is_platform_admin() THEN
    IF OLD.is_platform_admin IS TRUE THEN
      RAISE EXCEPTION 'Tenant administrators cannot modify a Platform Admin profile'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Only a Platform Admin or trusted backend can change a profile email'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'Only a Platform Admin can change a user's company assignment'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin THEN
      RAISE EXCEPTION 'Only a Platform Admin can change platform administrator status'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role AND NEW.role IN ('Super Admin', 'Platform Admin') THEN
      RAISE EXCEPTION 'Only a Platform Admin can assign privileged administrator roles'
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
  IF current_setting('request.jwt.claim.role', true) = 'service_role' OR session_user IN ('postgres', 'supabase_admin') OR public.is_platform_admin() THEN
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




-- Harden existing SECURITY DEFINER helpers and audit triggers reported by Supabase.
-- Helper functions remain executable by signed-in users because RLS policies call them.
ALTER FUNCTION public.get_my_company_id() SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_my_role() SET search_path = pg_catalog, public;
ALTER FUNCTION public.is_platform_admin() SET search_path = pg_catalog, public;
ALTER FUNCTION public.log_profile_audit() SET search_path = pg_catalog, public;
ALTER FUNCTION public.log_shipment_audit() SET search_path = pg_catalog, public;
ALTER FUNCTION public.enforce_shipment_workflow() SET search_path = pg_catalog, public;

REVOKE EXECUTE ON FUNCTION public.get_my_company_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_company_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;

-- These are trigger-only functions, not client-callable RPC endpoints.
REVOKE EXECUTE ON FUNCTION public.log_profile_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_shipment_audit() FROM PUBLIC, anon, authenticated;



-- Enforce the same operational role boundaries in the database that the UI
-- presents. Super Admin / Platform Admin retain explicit override capability.
CREATE OR REPLACE FUNCTION public.enforce_shipment_workflow()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_role text := public.get_my_role();
  details_changed boolean;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR actor_role = 'Super Admin'
     OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.awb_number IS DISTINCT FROM OLD.awb_number
     OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Shipment identity and tenant ownership cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  details_changed :=
    (to_jsonb(NEW) - ARRAY['current_status', 'payment_status', 'updated_at'])
    IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['current_status', 'payment_status', 'updated_at']);

  IF details_changed AND actor_role <> 'Customer Service' THEN
    RAISE EXCEPTION 'Only Customer Service or an administrator can edit shipment details'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status AND actor_role <> 'Finance' THEN
    RAISE EXCEPTION 'Only Finance or an administrator can change payment status'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.current_status IS NOT DISTINCT FROM NEW.current_status THEN
    RETURN NEW;
  END IF;

  IF OLD.current_status = 'Registered' AND NEW.current_status = 'Booked' AND actor_role = 'Freight' THEN
    RETURN NEW;
  END IF;
  IF OLD.current_status = 'Booked' AND NEW.current_status = 'Picked Up' AND actor_role = 'RFS' THEN
    RETURN NEW;
  END IF;
  IF OLD.current_status = 'Picked Up' AND NEW.current_status IN ('Delivered', 'Handed to Ops') AND actor_role = 'RFS' THEN
    RETURN NEW;
  END IF;
  IF OLD.current_status = 'Handed to Ops' AND NEW.current_status IN ('Export Cleared', 'Handed to Airline') AND actor_role = 'Operations' THEN
    RETURN NEW;
  END IF;
  IF OLD.current_status = 'Export Cleared' AND NEW.current_status = 'Handed to Airline' AND actor_role = 'Operations' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Role % cannot transition shipment from % to %. Follow the assigned operational workflow.',
    COALESCE(actor_role, 'Unknown'), OLD.current_status, NEW.current_status
    USING ERRCODE = '42501';
END;
$$;

-- Shipment registration is limited to the roles shown in the registration UI.
DROP POLICY IF EXISTS shipments_insert ON public.shipments;
CREATE POLICY shipments_insert
ON public.shipments
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = (SELECT public.get_my_company_id())
  AND (
    (SELECT public.get_my_role()) IN ('Super Admin', 'Customer Service', 'Freight')
    OR (SELECT public.is_platform_admin())
  )
);

-- Freight users are shown the financial ledger in the application.
DROP POLICY IF EXISTS payments_select ON public.payments;
CREATE POLICY payments_select
ON public.payments
FOR SELECT
TO authenticated
USING (
  company_id = (SELECT public.get_my_company_id())
  AND (
    (SELECT public.get_my_role()) IN ('Super Admin', 'Customer Service', 'Finance', 'Freight', 'Platform Admin')
    OR (SELECT public.is_platform_admin())
  )
);


-- Consolidate overlapping tenant/platform policies without weakening access.
DROP POLICY IF EXISTS platform_admin_companies ON public.companies;
DROP POLICY IF EXISTS companies_select ON public.companies;
CREATE POLICY companies_select
ON public.companies
FOR SELECT
TO authenticated
USING (
  id = (SELECT public.get_my_company_id())
  OR (SELECT public.is_platform_admin())
);

DROP POLICY IF EXISTS companies_update ON public.companies;
CREATE POLICY companies_update
ON public.companies
FOR UPDATE
TO authenticated
USING (
  (SELECT public.is_platform_admin())
  OR (
    id = (SELECT public.get_my_company_id())
    AND (SELECT public.get_my_role()) IN ('Super Admin', 'Platform Admin')
  )
)
WITH CHECK (
  (SELECT public.is_platform_admin())
  OR (
    id = (SELECT public.get_my_company_id())
    AND (SELECT public.get_my_role()) IN ('Super Admin', 'Platform Admin')
  )
);

DROP POLICY IF EXISTS companies_insert_platform_admin ON public.companies;
CREATE POLICY companies_insert_platform_admin
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS companies_delete_platform_admin ON public.companies;
CREATE POLICY companies_delete_platform_admin
ON public.companies
FOR DELETE
TO authenticated
USING ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS platform_admin_profiles ON public.profiles;
DROP POLICY IF EXISTS profiles_select_company ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_scoped
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (SELECT public.is_platform_admin())
  OR company_id = (SELECT public.get_my_company_id())
  OR id = (SELECT auth.uid())
);

DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  (SELECT public.is_platform_admin())
  OR (
    company_id = (SELECT public.get_my_company_id())
    AND (SELECT public.get_my_role()) IN ('Super Admin', 'Platform Admin')
  )
)
WITH CHECK (
  (SELECT public.is_platform_admin())
  OR (
    company_id = (SELECT public.get_my_company_id())
    AND (SELECT public.get_my_role()) IN ('Super Admin', 'Platform Admin')
  )
);

DROP POLICY IF EXISTS profiles_insert_platform_admin ON public.profiles;
CREATE POLICY profiles_insert_platform_admin
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS profiles_delete_platform_admin ON public.profiles;
CREATE POLICY profiles_delete_platform_admin
ON public.profiles
FOR DELETE
TO authenticated
USING ((SELECT public.is_platform_admin()));

-- The public shipments view must execute with the caller's privileges so
-- underlying shipments RLS remains in force for every tenant.
ALTER VIEW public.shipments_secure SET (security_invoker = true);
REVOKE ALL ON TABLE public.shipments_secure FROM anon;
GRANT SELECT ON TABLE public.shipments_secure TO authenticated;

-- These client inserts intentionally omit company_id; derive it from the
-- authenticated profile and let the existing RLS WITH CHECK enforce ownership.
ALTER TABLE public.notifications
  ALTER COLUMN company_id SET DEFAULT public.get_my_company_id();
ALTER TABLE public.shipment_comments
  ALTER COLUMN company_id SET DEFAULT public.get_my_company_id();
ALTER TABLE public.shipment_timeline
  ALTER COLUMN company_id SET DEFAULT public.get_my_company_id();

-- No anonymous browser session needs direct privileges on tenant business data.
REVOKE ALL ON TABLE
  public.audit_logs,
  public.clients,
  public.companies,
  public.notifications,
  public.payments,
  public.profiles,
  public.shipment_comments,
  public.shipment_documents,
  public.shipment_timeline,
  public.shipments,
  public.shipments_secure
FROM anon;

-- Audit events are written by trusted SECURITY DEFINER triggers only.
DROP POLICY IF EXISTS audit_insert_system ON public.audit_logs;
REVOKE INSERT ON TABLE public.audit_logs FROM anon, authenticated;

-- Cover every FK identified by the live Supabase performance advisor.
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON public.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company_id ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON public.notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON public.payments(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_shipment_comments_company_id ON public.shipment_comments(company_id);
CREATE INDEX IF NOT EXISTS idx_shipment_comments_shipment_id ON public.shipment_comments(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_documents_company_id ON public.shipment_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_shipment_documents_shipment_id ON public.shipment_documents(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_documents_shipment_company ON public.shipment_documents(shipment_id, company_id);
CREATE INDEX IF NOT EXISTS idx_shipment_timeline_company_id ON public.shipment_timeline(company_id);
CREATE INDEX IF NOT EXISTS idx_shipment_timeline_shipment_id ON public.shipment_timeline(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipments_company_id ON public.shipments(company_id);

-- Enforce tenant consistency between shipments and their child records.
-- Existing live-data checks found no cross-company references.
ALTER TABLE public.payments
  ADD CONSTRAINT payments_shipment_company_fkey
  FOREIGN KEY (shipment_id, company_id)
  REFERENCES public.shipments(id, company_id)
  ON DELETE CASCADE NOT VALID;
ALTER TABLE public.payments VALIDATE CONSTRAINT payments_shipment_company_fkey;

ALTER TABLE public.shipment_comments
  ADD CONSTRAINT shipment_comments_shipment_company_fkey
  FOREIGN KEY (shipment_id, company_id)
  REFERENCES public.shipments(id, company_id)
  ON DELETE CASCADE NOT VALID;
ALTER TABLE public.shipment_comments VALIDATE CONSTRAINT shipment_comments_shipment_company_fkey;

ALTER TABLE public.shipment_timeline
  ADD CONSTRAINT shipment_timeline_shipment_company_fkey
  FOREIGN KEY (shipment_id, company_id)
  REFERENCES public.shipments(id, company_id)
  ON DELETE CASCADE NOT VALID;
ALTER TABLE public.shipment_timeline VALIDATE CONSTRAINT shipment_timeline_shipment_company_fkey;

-- A shipment may only reference a client belonging to the same tenant.
ALTER TABLE public.clients
  ADD CONSTRAINT clients_id_company_unique UNIQUE (id, company_id);
CREATE INDEX IF NOT EXISTS idx_shipments_client_company ON public.shipments(client_id, company_id);
ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_client_company_fkey
  FOREIGN KEY (client_id, company_id)
  REFERENCES public.clients(id, company_id)
  ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.shipments VALIDATE CONSTRAINT shipments_client_company_fkey;

-- Enforce document/logo restrictions at the Storage service, not only in the browser.
UPDATE storage.buckets
SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png']
WHERE id = 'shipment-documents';

-- Uploads use new unique object paths (upsert=false). Tenants do not need object UPDATE.
DROP POLICY IF EXISTS storage_update_own_company ON storage.objects;
