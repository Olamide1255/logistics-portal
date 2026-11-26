'use client';

type ProductEvent =
  | 'workspace_signup_completed'
  | 'shipment_created'
  | 'employee_invite_sent'
  | 'operations_report_exported';

type AnalyticsWindow = Window & {
  posthog?: { capture?: (event: string) => void };
};

export function trackProductEvent(event: ProductEvent) {
  try {
    if (window.localStorage.getItem('logiflow-cookie-consent') !== 'accepted') return;
    (window as AnalyticsWindow).posthog?.capture?.(event);
  } catch {
    // Analytics must never interrupt a customer workflow.
  }
}
