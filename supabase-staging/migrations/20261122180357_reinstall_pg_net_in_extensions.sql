DO $migration$
DECLARE
  v_extension_schema text;
BEGIN
  SELECT n.nspname
    INTO v_extension_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_net';

  IF v_extension_schema = 'public' THEN
    EXECUTE 'DROP EXTENSION pg_net';
    EXECUTE 'CREATE EXTENSION pg_net WITH SCHEMA extensions';
  ELSIF v_extension_schema IS NULL THEN
    EXECUTE 'CREATE EXTENSION pg_net WITH SCHEMA extensions';
  END IF;

  IF to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL THEN
    RAISE EXCEPTION 'pg_net HTTP POST function is unavailable after installation';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.notifications'::regclass
      AND tgname = 'push_trigger'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Notification push trigger is missing';
  END IF;
END;
$migration$;
