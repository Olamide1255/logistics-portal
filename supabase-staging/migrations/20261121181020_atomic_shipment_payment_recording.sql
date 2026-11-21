CREATE OR REPLACE FUNCTION public.record_shipment_payment(
  p_shipment_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_company_id uuid;
  v_currency text;
  v_payment_status text;
  v_actor_role text;
  v_actor_email text;
  v_agreed_amount numeric;
  v_total_paid numeric := 0;
  v_payment_id uuid;
  v_financials jsonb;
  v_auto_approved boolean := false;
BEGIN
  IF auth.uid() IS NULL OR p_shipment_id IS NULL THEN
    RAISE EXCEPTION 'Authentication and a shipment are required'
      USING ERRCODE = '42501';
  END IF;

  v_actor_role := private.get_my_role();
  IF v_actor_role NOT IN ('Finance', 'Super Admin') THEN
    RAISE EXCEPTION 'Only Finance or Super Admin users can record payments'
      USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0
     OR p_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  IF p_payment_method IS NULL
     OR p_payment_method NOT IN ('Bank Transfer', 'Cash', 'Cheque', 'POS') THEN
    RAISE EXCEPTION 'Select a valid payment method'
      USING ERRCODE = '22023';
  END IF;

  IF p_reference IS NOT NULL AND length(p_reference) > 255 THEN
    RAISE EXCEPTION 'Payment reference cannot exceed 255 characters'
      USING ERRCODE = '22001';
  END IF;

  SELECT s.company_id, upper(coalesce(nullif(btrim(s.currency), ''), 'NGN')), s.payment_status
    INTO v_company_id, v_currency, v_payment_status
  FROM public.shipments_secure s
  WHERE s.id = p_shipment_id;

  IF NOT FOUND OR v_company_id IS NULL THEN
    RAISE EXCEPTION 'Shipment not found or unavailable to this company'
      USING ERRCODE = '42501';
  END IF;

  IF v_payment_status = 'Approved' THEN
    RAISE EXCEPTION 'This shipment is already approved and cannot accept another payment'
      USING ERRCODE = '22023';
  END IF;

  v_financials := public.get_shipment_financials(p_shipment_id);
  v_agreed_amount := nullif(v_financials ->> 'agreed_amount', '')::numeric;

  SELECT coalesce(sum(p.amount), 0)
    INTO v_total_paid
  FROM public.payments p
  WHERE p.shipment_id = p_shipment_id
    AND p.company_id = v_company_id;

  IF v_agreed_amount IS NOT NULL
     AND v_agreed_amount > 0
     AND p_amount > greatest(v_agreed_amount - v_total_paid, 0) THEN
    RAISE EXCEPTION 'Payment exceeds the outstanding shipment balance'
      USING ERRCODE = '22023';
  END IF;

  SELECT p.email
    INTO v_actor_email
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.company_id = v_company_id;

  IF nullif(btrim(v_actor_email), '') IS NULL THEN
    RAISE EXCEPTION 'An active company profile is required to record payments'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.payments (
    company_id,
    shipment_id,
    amount,
    currency,
    payment_method,
    reference,
    recorded_by
  )
  VALUES (
    v_company_id,
    p_shipment_id,
    p_amount,
    v_currency,
    p_payment_method,
    nullif(btrim(p_reference), ''),
    v_actor_email
  )
  RETURNING id INTO v_payment_id;

  v_total_paid := v_total_paid + p_amount;

  IF v_agreed_amount IS NOT NULL
     AND v_agreed_amount > 0
     AND v_total_paid >= v_agreed_amount THEN
    UPDATE public.shipments
    SET payment_status = 'Approved'
    WHERE id = p_shipment_id
      AND payment_status = 'Pending';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Shipment payment status could not be approved'
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
      'Payment completed in full.',
      v_actor_role,
      v_actor_email
    );

    v_auto_approved := true;
  END IF;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'auto_approved', v_auto_approved,
    'total_paid', v_total_paid,
    'balance', CASE
      WHEN v_agreed_amount IS NOT NULL AND v_agreed_amount > 0
        THEN greatest(v_agreed_amount - v_total_paid, 0)
      ELSE NULL
    END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_shipment_payment(uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_shipment_payment(uuid, numeric, text, text) TO authenticated;