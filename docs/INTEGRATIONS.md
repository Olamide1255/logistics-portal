# External service integrations

LogiFlow keeps optional third-party integrations limited to PostHog and Resend. Supabase remains the core authentication, database, storage and rate-limiting service; Vercel remains the application host. Never commit API keys, tokens or service credentials.

## Resend — future transactional email transport

Resend is not currently connected. It is the planned SMTP transport for Supabase Auth after a verified sending domain is available. Supabase Auth will continue generating and validating signup verification, invitation and password-reset links; Resend will only transport those messages.

1. Add and verify a sending domain in Resend. Configure the SPF and DKIM records Resend provides; publish a DMARC policy for the domain.
2. In Supabase Dashboard, open **Authentication → SMTP Settings** and enable custom SMTP.
3. Use Resend's SMTP endpoint `smtp.resend.com`, port `465` (implicit TLS) or `587` (STARTTLS), username `resend`, and the Resend API key as the SMTP password.
4. Set the sender address to an address on the verified domain, for example `notifications@your-verified-domain`.
5. Keep email confirmation enabled and auto-confirm disabled in Supabase Auth. Set the same sender identity in Supabase Auth, save, and send a test signup/invitation/reset email to an external mailbox.
6. Keep the API key in the Supabase SMTP password field only. Do not expose it through a `NEXT_PUBLIC_*` variable or commit it to Git.

Until custom SMTP is enabled and tested, do not treat external customer onboarding as ready: Supabase's default hosted mailer is restricted to project-team addresses and is rate-limited. No domain purchase or Resend configuration is required for current local staging tests.

## PostHog — consent-aware product analytics and server logs

Set these Vercel environment variables in **Production**. Preview deployments are currently disabled for this project; add Preview values only if preview deployments are deliberately re-enabled. Set `NEXT_PUBLIC_SITE_URL` to the canonical production origin (`https://logistics-portal-ten.vercel.app`) in Production:
- `NEXT_PUBLIC_POSTHOG_KEY`: PostHog project token (`phc_...`).
- `NEXT_PUBLIC_POSTHOG_HOST`: your PostHog ingestion host, for example `https://eu.i.posthog.com` for an EU project or `https://us.i.posthog.com` for a US project.

Browser analytics are not loaded until a visitor accepts optional analytics cookies. Rejecting optional analytics prevents the SDK from loading. Autocapture and session recording are disabled. Page views use normalized paths: tracking tokens and AWB identifiers are never sent as URL values. Product events are limited to `workspace_signup_completed`, `shipment_created`, `employee_invite_sent` and `operations_report_exported`; they carry no event properties or record identifiers. Do not identify users or send shipment, customer, financial, email, document or other personal data to PostHog.

Server-side operational logs use the same PostHog project token and regional host, sent separately to PostHog's OTLP Logs endpoint. Next.js request/render errors generate a minimal diagnostic log containing a generic error label, route template, HTTP method and request source. Raw exception messages, stacks, headers, cookies, user identifiers, shipment data and request query strings are excluded. Server logs are separate from optional browser analytics and delivery is best-effort; they do not block application requests. No additional OpenTelemetry packages are required for this lightweight OTLP HTTP implementation.

## Deployment checklist

- Confirm PostHog's project token and regional host are configured in Vercel Production; never commit credentials.
- Confirm Resend's verified domain and custom SMTP credentials directly in Supabase Auth before enabling public customer email flows.
- Verify consent acceptance/rejection and PostHog page/event/log ingestion after the approved production deployment.
- Verify Resend delivery to an external mailbox before customer onboarding.
- Follow the one-deployment release policy: deploy once only after all required environment values and pre-deployment checks are reviewed.
