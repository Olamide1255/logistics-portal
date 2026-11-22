CREATE OR REPLACE FUNCTION public.apply_shipment_status_with_timeline(
  p_shipment_id uuid,
  p_status text,
  p_status_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required'
      USING ERRCODE = '42501';
  END IF;

  IF p_shipment_id IS NULL
     OR p_status IS NULL
     OR p_status NOT IN (
       'Registered',
       'Booked',
       'Picked Up',
       'Handed to Ops',
       'Export Cleared',
       'Handed to Airline',
       'Delivered'
     ) THEN
    RAISE EXCEPTION 'A valid shipment and workflow status are required'
      USING ERRCODE = '22023';
  END IF;

  IF length(coalesce(p_status_notes, '')) > 2000 THEN
    RAISE EXCEPTION 'Timeline notes must be 2000 characters or fewer'
      USING ERRCODE = '22001';
  END IF;

  UPDATE public.shipments
  SET current_status = p_status
  WHERE id = p_shipment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shipment not found or current user cannot update it'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.shipment_timeline (
    shipment_id,
    status_dropdown,
    status_notes,
    updated_by_role,
    action_by_name
  )
  VALUES (
    p_shipment_id,
    p_status,
    p_status_notes,
    coalesce((SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()), 'Unknown'),
    coalesce((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), 'Unknown')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_shipment_payment_with_timeline(
  p_shipment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR p_shipment_id IS NULL THEN
    RAISE EXCEPTION 'Authentication and a shipment are required'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.shipments
  SET payment_status = 'Approved'
  WHERE id = p_shipment_id
    AND payment_status = 'Pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment was already approved or the shipment cannot be updated'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.shipment_timeline (
    shipment_id,
    status_dropdown,
    status_notes,
    updated_by_role,
    action_by_name
  )
  VALUES (
    p_shipment_id,
    'Finance Approved',
    'Payment confirmed.',
    coalesce((SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()), 'Unknown'),
    coalesce((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), 'Unknown')
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_shipment_status_with_timeline(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_shipment_status_with_timeline(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_shipment_payment_with_timeline(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_shipment_payment_with_timeline(uuid) TO authenticated;