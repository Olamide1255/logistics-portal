# External service integrations

This application keeps integrations optional and fails safely when a service is not configured. Never commit API keys, tokens, DSNs containing credentials, or service account secrets.

## Resend — transactional email

Supabase Auth currently sends signup verification, invitations and password-reset messages. Use Resend as the SMTP transport so those messages continue to use Supabase's token and confirmation flows.

1. Add and verify a sending domain in Resend. Configure the SPF and DKIM records Resend provides; publish a DMARC policy for the domain.
2. In Supabase Dashboard, open **Authentication → SMTP Settings** and enable custom SMTP.
3. Use Resend's SMTP endpoint `smtp.resend.com`, port `465` (recommended, implicit TLS) or `587` (STARTTLS), username `resend`, and the Resend API key as the SMTP password.
4. Set the sender address to an address on the verified domain, for example `notifications@your-verified-domain`.
5. Keep email confirmation enabled and auto-confirm disabled in Supabase Auth; the workspace signup flow deliberately refuses to create an unverified public administrator. Set the same sender identity in Supabase Auth, save, and send a test signup/invitation/reset email to an external mailbox.
6. Keep the API key in the Supabase SMTP password field only. Do not expose it through a `NEXT_PUBLIC_*` variable or commit it to Git.

Supabase Auth remains responsible for generating and validating secure action links; Resend transports the email. This avoids creating a second password-reset or invitation-token system. Until custom SMTP is enabled and tested, do not treat external customer onboarding as ready: Supabase's default hosted mailer is restricted to project-team addresses and is rate-limited.

## PostHog — consent-aware product analytics and server logs

Set these Vercel Production and Preview environment variables (the project token is intended to be public). Also set `NEXT_PUBLIC_SITE_URL` to the canonical production origin (currently `https://logistics-portal-ten.vercel.app`) in Production; use the actual preview origin only when you specifically need preview canonical metadata:
- `NEXT_PUBLIC_POSTHOG_KEY`: PostHog project token (`phc_...`).
- `NEXT_PUBLIC_POSTHOG_HOST`: your PostHog ingestion host, e.g. `https://us.i.posthog.com` or your regional host.

Browser analytics are not loaded until a visitor accepts optional analytics cookies. Rejecting optional analytics prevents the SDK from loading. Autocapture and session recording are disabled. Page views use normalized paths: tracking tokens and AWB identifiers are never sent as URL values. The initial product events are limited to `workspace_signup_completed`, `shipment_created`, `employee_invite_sent` and `operations_report_exported`; they carry no event properties or record identifiers. Do not identify users or send shipment, customer, financial, email, document or other personal data to PostHog.

Server-side operational logs use the same PostHog project token and regional host, but are sent separately to PostHog's OTLP Logs endpoint. The existing Next.js `instrumentation.ts` reports a minimal error log when Next.js reports a request/render error. Only a generic message, route template, HTTP method, and request source are sent; raw exception messages, stacks, headers, cookies, user identifiers, shipment data and request query strings are excluded. Logs are sent only when `NEXT_PUBLIC_POSTHOG_KEY` is configured. Delivery is best-effort and does not block application requests. No extra OpenTelemetry packages or Next.js instrumentation config flag are required for this lightweight OTLP HTTP implementation. If you later need general application logs or tracing, add the relevant OpenTelemetry SDK and explicitly flush it at the end of each serverless request.

## Sentry — error monitoring

Set `SENTRY_DSN` as a server-only Vercel environment variable. The application reports Next.js request errors and sanitized browser errors to Sentry using its envelope endpoint. No authentication token or Sentry organization API token is needed at runtime. Configure the Sentry project alert rules in Sentry itself. This dependency-free transport sends exception events and stack frames but does not upload source maps, so minified browser frames may not be symbolicated. Do not add a public DSN variable or send request cookies, headers, shipment details or financial data.

## Upstash Redis — distributed rate limiting

Set:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

The rate limiter uses Upstash's HTTPS REST pipeline when both values are present. If Redis is unavailable, it falls back to the existing durable Supabase rate-limit RPC. This keeps public endpoints protected during Redis outages and avoids requiring a new package. Use a dedicated Upstash database for this application and rotate the token if it is exposed.

## Pinecone — not enabled

Pinecone is intentionally not connected yet. The current portal has no semantic search, document retrieval, AI assistant or embedding workflow. Shipment, customer and financial data should not be copied into a vector index without a defined feature, tenant-isolation design, retention policy and explicit access controls. If semantic shipment/document search is approved later, use tenant-scoped namespaces and metadata filters, and keep authorization in Supabase before querying Pinecone.

## Deployment checklist

- Configure each provider's credentials directly in its dashboard and Vercel/Supabase environment settings.
- Add credentials to Production first; use separate test projects/keys for Preview.
- Redeploy once after all environment values are saved.
- Verify Resend delivery, PostHog consent/rejection behavior and server log ingestion, a Sentry test event, and Upstash rate-limit behavior before enabling the integrations for customers.
