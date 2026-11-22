# Staging environment

## Supabase project

- Project: `logistics-portal-staging`
- Project ref: `wudpgqqicypdipxzsrgj`
- Region: `eu-west-1`
- API URL: `https://wudpgqqicypdipxzsrgj.supabase.co`
- Plan: Free

This project is isolated from production. It contains only synthetic tenant data, two dedicated staging Auth users, and test shipment fixtures. It has its own Vault-managed notification webhook secret and staging Edge Function configuration; no production tenant data, user credentials, service-role key, or webhook secret are copied here. The `shipment-documents` bucket is private and starts empty.

## Schema and fixtures

The staging-only baseline is in `supabase-staging/migrations/20261120135146_staging_schema_baseline.sql`. Follow-up staging migrations mirror the relevant production schema and security changes. The staging baseline is deliberately kept outside the active production migration path so production's migration history is not rewritten; new SQL changes must be mirrored between the two migration directories and checked by CI.

Synthetic fixtures are in `supabase-staging/seed.sql` and can be reloaded with the staging CLI seed workflow. They are not part of the production Supabase configuration. Two tenants are created:

- `Staging Tenant Alpha` — `00000000-0000-4000-8000-000000000001`
- `Staging Tenant Beta` — `00000000-0000-4000-8000-000000000002`

The fixture shipments are `STG-ALPHA-0001` and `STG-BETA-0001`. They are deliberately distinct so the authenticated Playwright test can verify tenant isolation.

## Dedicated test identities

Two confirmed synthetic identities are already provisioned in staging Auth and mapped to their intended profiles:

- Platform Admin: `staging-platform-admin@example.test`
- Tenant user: `staging-tenant@example.test` (Customer Service, Tenant Alpha only)

Do not use production Marchlog users or real customer email addresses. If these test identities ever need to be recreated, create and confirm them in Supabase Dashboard → Authentication → Users, then map their Auth UUIDs to the profiles using the SQL below. Do not promote the tenant user to Platform Admin.

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

## GitHub Actions secrets

The staging URL, publishable client key and synthetic test email addresses are configured in `.github/workflows/quality.yml`. Only the two staging passwords need to be stored as GitHub Actions secrets.

In GitHub → repository `Olamide1255/logistics-portal` → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|---|---|
| `E2E_PLATFORM_ADMIN_PASSWORD` | Existing password for the staging Platform Admin identity |
| `E2E_TENANT_PASSWORD` | Existing password for the staging tenant identity |

The staging publishable key is intended for browser use; never add a `service_role` key to GitHub Actions or frontend environment variables. If the staging project is recreated or its publishable key is rotated, update the URL/key values in the workflow and re-provision the two synthetic identities.

Once these two password secrets exist, GitHub Actions builds the app against staging and runs the authenticated browser journeys locally in CI. This avoids needing a paid Supabase branch or a Vercel deployment for each test run. Without the passwords, lint/build and unauthenticated smoke tests still run, and the authenticated job is intentionally skipped.

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
