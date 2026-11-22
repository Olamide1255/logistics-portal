CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.get_notify_webhook_secret()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'vault', 'auth'
AS $function$
DECLARE
  v_secret text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role authentication is required'
      USING ERRCODE = '42501';
  END IF;

  SELECT decrypted_secret
    INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'logiflow_webhook_secret';

  IF v_secret IS NULL OR length(v_secret) < 32 THEN
    RAISE EXCEPTION 'Notification webhook secret is not configured'
      USING ERRCODE = '55000';
  END IF;

  RETURN v_secret;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_notify_webhook_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_notify_webhook_secret() TO service_role;

CREATE OR REPLACE FUNCTION private.notify_on_notification_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'vault', 'net'
AS $function$
DECLARE
  v_secret text;
  v_url text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'logiflow_webhook_secret';

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'notify_function_url';

  IF v_secret IS NULL OR v_url IS NULL THEN
    RAISE WARNING 'Notification webhook configuration is missing; push delivery was skipped.';
    RETURN NEW;
  END IF;

  BEGIN
    v_request_id := net.http_post(
      url := v_url,
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'notifications',
        'schema', 'public',
        'record', to_jsonb(NEW),
        'old_record', NULL
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Notification push dispatch failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.notify_on_notification_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS push_trigger ON public.notifications;
CREATE TRIGGER push_trigger
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION private.notify_on_notification_insert();