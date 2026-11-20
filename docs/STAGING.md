# Staging environment

## Supabase project

- Project: `logistics-portal-staging`
- Project ref: `wudpgqqicypdipxzsrgj`
- Region: `eu-west-1`
- API URL: `https://wudpgqqicypdipxzsrgj.supabase.co`
- Plan: Free

This project is isolated from production. It contains no production tenant data, Auth users, Storage objects, secrets, or notification webhook. The `shipment-documents` bucket is private and starts empty. The production database and production notification trigger are not modified by this setup.

## Schema and fixtures

The reproducible baseline is in `supabase/migrations/20261120135146_staging_schema_baseline.sql`. The prior incremental production migrations are retained under `supabase/migrations/archive/` for history and are not applied as new migrations.

Synthetic fixtures are in `supabase/seed.sql` and can be reloaded with the Supabase CLI seed workflow. Two tenants are created:

- `Staging Tenant Alpha` — `00000000-0000-4000-8000-000000000001`
- `Staging Tenant Beta` — `00000000-0000-4000-8000-000000000002`

The fixture shipments are `STG-ALPHA-0001` and `STG-BETA-0001`. They are deliberately distinct so the authenticated Playwright test can verify tenant isolation.

## Create dedicated test identities

Do not use production Marchlog users or real customer email addresses.

1. Open Supabase Dashboard → Authentication → Users for the staging project.
2. Create and confirm a user with email `staging-platform-admin@example.test`. Use a unique password generated for staging.
3. Create and confirm a second user with email `staging-tenant@example.test`. Use a different unique password.
4. Copy both generated Auth user UUIDs.
5. In the staging SQL Editor, replace the two UUID placeholders below and execute:

```sql
insert into public.profiles (id,email,role,company_id,is_platform_admin)
values
  ('<PLATFORM_AUTH_USER_UUID>','staging-platform-admin@example.test','Platform Admin',null,true),
  ('<TENANT_AUTH_USER_UUID>','staging-tenant@example.test','Customer Service','00000000-0000-4000-8000-000000000001',false)
on conflict (id) do update set
  email=excluded.email,
  role=excluded.role,
  company_id=excluded.company_id,
  is_platform_admin=excluded.is_platform_admin;
```

The first identity is global Platform Admin. The second belongs only to Tenant Alpha. Do not make the tenant identity a Platform Admin.

## GitHub Actions secrets

In GitHub → repository `Olamide1255/logistics-portal` → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|---|---|
| `STAGING_SUPABASE_URL` | `https://wudpgqqicypdipxzsrgj.supabase.co` |
| `STAGING_SUPABASE_ANON_KEY` | Staging project's publishable key (or legacy anon key) |
| `E2E_PLATFORM_ADMIN_EMAIL` | `staging-platform-admin@example.test` |
| `E2E_PLATFORM_ADMIN_PASSWORD` | Password chosen for the staging Platform Admin |
| `E2E_TENANT_EMAIL` | `staging-tenant@example.test` |
| `E2E_TENANT_PASSWORD` | Password chosen for the staging tenant user |

Get the publishable key from Supabase Dashboard → Project Settings → API Keys. It is a client key and is safe for the browser; never add a `service_role` key to GitHub Actions or frontend environment variables.

Once these six secrets exist, GitHub Actions builds the app against staging and runs the authenticated browser journeys locally in CI. This avoids needing a paid Supabase branch or a Vercel deployment for each test run. Without these secrets, lint/build and unauthenticated smoke tests still run, and the authenticated job is intentionally skipped.

## Vercel Preview (optional)

If/when Vercel preview deployments are available again, set these variables for the **Preview** environment only:

- `NEXT_PUBLIC_SUPABASE_URL` = staging API URL above
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = staging publishable/anon key

Keep the Production environment variables pointing at the production Supabase project. The current Vercel deployment account previously returned a build-quota failure, so a preview deployment is not claimed as available.

## Safety rules

- Never connect the staging deployment to production Supabase.
- Never copy production tenant records, users, files, service-role keys, SMTP credentials, or webhook tokens into staging.
- Keep test identities separate and rotate their passwords if they are exposed.
- The Free project may pause after inactivity; restore it from Supabase before running CI if it has paused.
- Billing remains deliberately out of scope until the non-billing work is completed.
