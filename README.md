# LogiFlow — Logistics Operations Portal

A multi-tenant logistics operations platform for freight forwarders and clearing agents. LogiFlow brings shipment registration, operational milestones, customer records, finance workflows, documents, customer tracking and platform administration into one workspace.

## Product capabilities

- **Shipment operations:** register and search AWBs, manage shipment milestones, comments, documents and operational handovers.
- **Finance:** record shipment payments, review receivables and delivery performance, and export operational reports. Currency totals remain separated; the platform does not assume foreign-exchange rates.
- **Customer experience:** share secure, token-based public tracking links without exposing private shipment or financial information.
- **Company administration:** manage team access, company profile and audit history.
- **Platform administration:** monitor tenant health, onboarding, account status and platform-level usage.
- **Resilient workflows:** notification updates, safe offline comment capture and automatic reconnection sync.

## Technology

- Next.js 16 App Router and React 19
- TypeScript and Tailwind CSS
- Supabase Postgres, Auth, Row Level Security, Storage, Realtime and Edge Functions
- Vercel for application hosting
- Playwright for browser and API authorization tests

## Local development

### Requirements

- Node.js 22 or newer
- npm
- A Supabase project for local development or the isolated staging project

### Install

```bash
npm ci
```

Create a local `.env.local` file. Use the staging project for development and testing:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<staging-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-publishable-or-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-staging-service-role-key>
```

The service-role key is server-only. Never prefix it with `NEXT_PUBLIC_`, commit it, paste it into client components, or reuse the production key in staging. Keep production and staging credentials separate.

Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality checks

Run these before opening or updating a pull request:

```bash
npm run lint
npm run check:staging-migrations
npm run build
npm run test:e2e
```

The GitHub Actions quality workflow runs migration parity, lint, a production build, API authorization smoke tests and local browser smoke tests. Authenticated staging journeys run only when the dedicated staging test credentials are configured. See [docs/STAGING.md](docs/STAGING.md) for the isolated test environment and setup.

## Database and migration workflow

- Production migrations live in `supabase/migrations/`.
- Matching staging migrations live in `supabase-staging/migrations/`.
- Keep each mirrored SQL migration identical; environment-specific migration filename prefixes may differ where the staging baseline requires it.
- Run `npm run check:staging-migrations` to verify parity.
- Apply and validate changes in staging before applying them to production.
- Never use production tenant data as staging fixtures. Staging uses synthetic tenants and shipments.

## Security model

- Tenant access is enforced in PostgreSQL with Row Level Security, not just by hiding UI controls.
- Shipment read screens use the tenant-scoped `shipments_secure` read model. Financial fields are fetched through role-checked RPCs.
- The secure shipment view is read-only for authenticated clients; shipment mutations go through the base-table policies and workflow integrity checks.
- Payments, timeline entries, comments, documents and notifications have database-side integrity controls.
- Public tracking is served through a narrowly scoped anonymous RPC and exposes only approved tracking fields.
- The `shipment-documents` bucket is private. Documents are opened through short-lived signed URLs.
- Platform administration is separate from tenant administration. Never grant platform-admin status to a tenant user to solve a tenant permission issue.

### Notification webhook secrets

Push notification delivery uses a private bearer secret stored in Supabase Vault separately in each environment.

- The database trigger reads `logiflow_webhook_secret` and `notify_function_url` from Vault.
- The Edge Function retrieves the same secret through `get_notify_webhook_secret()`, which is executable only by the Supabase `service_role`.
- The function has JWT gateway verification disabled because it performs its own constant-time-equivalent bearer comparison before processing a webhook. Do not expose the service-role key or Vault secret to browser code.
- The database uses `pg_net` to dispatch the webhook asynchronously. Notification inserts remain committed even if push delivery fails.

For a new project, create the two Vault entries before enabling the notification trigger. Use that project's own function URL:

```sql
DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'logiflow_webhook_secret') THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'logiflow_webhook_secret',
      'Private notification webhook bearer secret'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'notify_function_url') THEN
    PERFORM vault.create_secret(
      'https://<project-ref>.supabase.co/functions/v1/notify',
      'notify_function_url',
      'Internal notification Edge Function URL'
    );
  END IF;
END $;
```

Never query or print the decrypted secret in logs, commits, support messages or browser responses. Deploy `supabase/functions/notify` with `verify_jwt=false`; its Vault-backed authentication is mandatory.

## Application routes

| Route | Purpose |
|---|---|
| `/` | Product landing page |
| `/login` | Workspace sign-in |
| `/signup` | Company workspace onboarding |
| `/dashboard` | Tenant operations overview |
| `/dashboard/shipments` | Shipment register |
| `/dashboard/register` | New shipment registration |
| `/dashboard/reports` | Finance and operations reports |
| `/dashboard/clients` | Client register and reporting |
| `/dashboard/employees` | Company team access |
| `/dashboard/settings` | Company settings |
| `/dashboard/audit-logs` | Company audit history |
| `/platform` | Platform administration |
| `/track/[token]` | Public customer tracking |

The retired `/register` test route redirects to the authenticated shipment-registration workflow.

## Release discipline

- Work on a feature branch and open a pull request against `main`.
- Require passing quality checks before merging.
- Validate database migrations in staging and review the production diff before rollout.
- Preserve the free Vercel deployment quota: avoid preview builds and deploy to production only once the release candidate is complete and verified.
- After deployment, verify the production alias, critical routes, runtime logs and core tenant workflows.
- Authenticated browser journeys still require a dedicated staging identity and should not be substituted with production customer accounts.

## Scope

Subscription billing and payment collection are intentionally deferred until the non-billing product, security and workflow work is complete.
