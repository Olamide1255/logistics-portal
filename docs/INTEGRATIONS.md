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

## PostHog — consent-aware product analytics

Set these Vercel Production and Preview environment variables (the project token is intended to be public). Also set `NEXT_PUBLIC_SITE_URL` to the canonical production origin (currently `https://logistics-portal-ten.vercel.app`) in Production; use the actual preview origin only when you specifically need preview canonical metadata:
- `NEXT_PUBLIC_POSTHOG_KEY`: PostHog project token (`phc_...`).
- `NEXT_PUBLIC_POSTHOG_HOST`: your PostHog ingestion host, e.g. `https://us.i.posthog.com` or your regional host.

Analytics are not loaded until a visitor accepts optional analytics cookies. Rejecting optional analytics prevents the SDK from loading. Autocapture and session recording are disabled. Page views use normalized paths: tracking tokens and AWB identifiers are never sent as URL values. Do not identify users or send shipment, customer, financial, email, document or other personal data to PostHog.

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
- Verify Resend delivery, PostHog consent/rejection behavior, a Sentry test event, and Upstash rate-limit behavior before enabling the integrations for customers.
