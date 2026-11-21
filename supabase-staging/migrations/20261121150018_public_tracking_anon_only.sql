-- Public tracking is intentionally anonymous and token-only; signed-in roles use the same public payload without extra privileges.
revoke all on function public.get_public_shipment_tracking(text) from public, authenticated;
grant execute on function public.get_public_shipment_tracking(text) to anon;
comment on function public.get_public_shipment_tracking(text) is
  'Intentional anonymous endpoint: returns only customer-safe shipment milestones for a 64-character opaque tracking token.';
