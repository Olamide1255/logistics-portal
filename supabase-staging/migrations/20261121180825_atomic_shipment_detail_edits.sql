CREATE OR REPLACE FUNCTION public.update_shipment_details_with_timeline(
  p_shipment_id uuid,
  p_sender_details text,
  p_receiver_details text,
  p_weight numeric,
  p_dimensions text,
  p_origin text,
  p_destination text,
  p_commodity_type text,
  p_shipment_type text,
  p_service_type text,
  p_agreed_amount numeric,
  p_rate numeric,
  p_currency text,
  p_expected_delivery_date date,
  p_payment_due_date date
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

  IF length(trim(coalesce(p_sender_details, ''))) = 0
     OR length(trim(coalesce(p_receiver_details, ''))) = 0
     OR length(trim(coalesce(p_origin, ''))) = 0
     OR length(trim(coalesce(p_destination, ''))) = 0
     OR length(trim(coalesce(p_commodity_type, ''))) = 0
     OR length(trim(coalesce(p_dimensions, ''))) = 0
     OR p_weight IS NULL OR p_weight <= 0 THEN
    RAISE EXCEPTION 'Complete shipment details and a positive weight are required'
      USING ERRCODE = '22023';
  END IF;

  IF p_shipment_type IS NULL
     OR p_shipment_type NOT IN ('Export', 'Import')
     OR p_service_type IS NULL
     OR p_service_type NOT IN ('DDP', 'DAP', 'D2P', 'FOB', 'EXW', 'AFW')
     OR p_currency IS NULL
     OR p_currency NOT IN ('NGN', 'USD')
     OR (p_rate IS NOT NULL AND p_rate < 0)
     OR (p_agreed_amount IS NOT NULL AND p_agreed_amount < 0) THEN
    RAISE EXCEPTION 'One or more shipment values are invalid'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.shipments
  SET
    sender_details = trim(p_sender_details),
    receiver_details = trim(p_receiver_details),
    weight = p_weight,
    dimensions = trim(p_dimensions),
    origin = trim(p_origin),
    destination = trim(p_destination),
    commodity_type = trim(p_commodity_type),
    shipment_type = p_shipment_type,
    service_type = p_service_type,
    agreed_amount = p_agreed_amount,
    rate = p_rate,
    currency = p_currency,
    expected_delivery_date = p_expected_delivery_date,
    payment_due_date = p_payment_due_date
  WHERE id = p_shipment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shipment not found or current user cannot edit it'
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
    'Details Edited',
    'Shipment info corrected.',
    coalesce((SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()), 'Unknown'),
    coalesce((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), 'Unknown')
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.update_shipment_details_with_timeline(uuid, text, text, numeric, text, text, text, text, text, text, numeric, numeric, text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_shipment_details_with_timeline(uuid, text, text, numeric, text, text, text, text, text, text, numeric, numeric, text, date, date) TO authenticated;