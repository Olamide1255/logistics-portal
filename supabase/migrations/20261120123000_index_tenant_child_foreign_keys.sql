-- Cover the composite tenant-scoped shipment foreign keys.
CREATE INDEX IF NOT EXISTS idx_payments_shipment_company
  ON public.payments (shipment_id, company_id);
CREATE INDEX IF NOT EXISTS idx_shipment_comments_shipment_company
  ON public.shipment_comments (shipment_id, company_id);
CREATE INDEX IF NOT EXISTS idx_shipment_timeline_shipment_company
  ON public.shipment_timeline (shipment_id, company_id);
