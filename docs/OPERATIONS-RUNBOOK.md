# Production operations runbook

Last reviewed: 22 November 2026

## Current hosting posture

- Application: Vercel production deployment.
- Database/Auth/Storage: Supabase production project.
- Current Supabase organization plan: Free.
- Current Vercel project: Hobby/Free.
- Preview deployments are disabled to avoid unnecessary builds and quota use.

**Commercial-use gate:** Vercel's Hobby plan is designated for personal, non-commercial use. This portal is intended to serve logistics companies, so confirm that the hosting plan's terms permit the intended customer-facing/commercial use before onboarding paying clients. A free-only constraint does not override the provider's plan terms. See [Vercel Hobby plan](https://vercel.com/docs/plans/hobby).
- Production release policy: merge reviewed work, allow one production deployment, verify that exact deployment, and do not redeploy for cosmetic reassurance.

## Monitoring

### Routine checks

1. Confirm the production deployment is **Ready** and matches the intended Git commit.
2. Check `/`, `/login`, `/signup`, `/api/version` and `/api/health`.
3. Review Vercel Runtime Logs for 5xx responses and uncaught function errors.
4. Review Supabase Security, Health and Performance advisors.
5. Review Supabase Auth and Edge Function logs for failed logins, invitation failures and notification webhook errors.
6. Confirm the `notify` Edge Function remains active and the private `shipment-documents` bucket remains private.
7. Confirm tenant data remains isolated when a support or test account is used.

A lightweight GitHub Actions production health check runs every six hours and can also be run manually. It checks public application routes and `/api/health`; the latter verifies database connectivity, Auth Admin availability and that the shipment-documents bucket still exists and remains private. It returns only `ok` or `unavailable`, without exposing tenant data.

### Free-tier monitoring limitations

- Vercel Hobby retains only one hour of runtime logs and does not include configurable Log Drains. Use the GitHub scheduled health check for basic availability and inspect Vercel logs promptly after an incident.
- Supabase Free does not include automatic daily database backups, Point-in-Time Recovery or Log Drains. Supabase API/database log retention is one day.
- Supabase Free projects can pause after one week of inactivity and the organization has a limit of two active Free projects. Keep production active and periodically exercise staging so it does not go idle.
- Monitor Free-plan quotas: 500 MB database per project, 1 GB Storage, 5 GB egress and 500,000 Edge Function invocations. These limits can become launch constraints as tenants and documents grow.

## Database backup and recovery

**Important: no automatic production database backup is configured.** Supabase's Free plan does not automatically back up databases. Manual backups are therefore a required operational task before accepting important customer data and before every production migration.

### Manual backup procedure

Run from a trusted workstation with the Supabase CLI installed. Obtain the production database connection string from Supabase Dashboard → Project Settings → Database. Do not paste it into chat, commit it, or store it in a public repository.

Use the current Supabase CLI's `supabase db dump --help` to confirm flag compatibility. The current Supabase backup guide documents `--db-url`; newer CLI versions may expose the equivalent `--remote` flag. Export schema, data, roles and migration history separately:

```bash
mkdir -p backups
supabase db dump --db-url "$SUPABASE_DB_URL" -f "backups/roles-$(date -u +%F).sql" --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f "backups/schema-$(date -u +%F).sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "backups/data-$(date -u +%F).sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "backups/history-schema-$(date -u +%F).sql" --schema supabase_migrations
supabase db dump --db-url "$SUPABASE_DB_URL" -f "backups/history-data-$(date -u +%F).sql" --use-copy --data-only --schema supabase_migrations
sha256sum backups/*.sql > "backups/SHA256SUMS-$(date -u +%F).txt"
```

The Supabase CLI dump excludes Supabase-managed schemas such as Auth and Storage. These database dumps alone are **not a complete backup of user identities or uploaded documents**. Keep a separate, secure export of required Storage objects and maintain an account-recovery/re-invitation plan for Auth users. Never put raw user exports, document files, database dumps or password hashes in this public Git repository.

Encrypt backups before moving them off the workstation. Keep at least one copy outside the production Supabase project and one offline copy. Record the date, project reference, operator and checksum, but never record credentials.

### Schedule

- Before every production schema migration: take a fresh backup.
- Weekly: take a full manual database dump and export required Storage objects.
- Monthly: verify checksums and perform a restore drill into an isolated local Supabase environment.
- After a restore drill: confirm RLS, grants, triggers, functions, Storage policies and Auth-to-profile mappings before treating the restored environment as usable.

### Recovery rules

1. Stop further releases and identify the incident window.
2. Preserve logs and the latest known-good backup.
3. Restore into an isolated environment first; never experiment with restore commands against production.
4. Validate migrations, RLS, roles, triggers, Edge Functions, Storage objects and representative tenant workflows.
5. Agree on the recovery point with the business owner before any production replacement.
6. Record what was restored, what could not be restored and any data gap.
7. Re-enable normal operations only after tenant isolation and critical workflows pass.

Never run `supabase db reset --linked` or a remote reset command against production.

## Incident response

### Severity guide

- **P1 — Critical:** suspected cross-tenant exposure, unauthorized financial change, production unavailable, confirmed data loss or compromised privileged account.
- **P2 — High:** a core workflow (shipment registration, payment, booking, RFS or Operations handover) is unavailable for a tenant.
- **P3 — Normal:** isolated UI defect, report discrepancy with no financial/security impact, or non-blocking performance issue.

### Response checklist

1. Record the time, affected tenant (if known), user role, page/API and error reference.
2. For suspected account compromise, revoke the affected session and disable the affected account through the trusted admin path.
3. For suspected tenant exposure, stop the affected workflow and preserve relevant logs; do not attempt ad-hoc data edits.
4. For payment or workflow corruption, preserve the affected shipment/payment IDs and inspect audit/timeline entries before any correction.
5. Open a private support incident record. Do not post customer data, logs containing tokens, credentials or unredacted personal details in public GitHub issues.
6. Assign an owner and track the fix through a reviewed pull request.
7. Close only after the affected tenant and adjacent roles have been rechecked.

Suggested internal response targets (not contractual SLAs): acknowledge P1 immediately during active operations, P2 within one business day, and P3 within three business days. Publish customer-facing response commitments only after support coverage is formally staffed.

## Release and rollback

- Work on a feature branch and open a pull request.
- Require migration mirror checks, lint, build, API authorization smoke tests and browser smoke tests to pass.
- Do not merge when a required check fails.
- Review database migration impact and take a pre-release backup.
- Merge once; verify the single production deployment's commit and Ready state.
- Check public routes, runtime errors and critical Supabase logs.
- If application rollback is required, use the last known-good deployment and assess database compatibility first. A code rollback does not reverse database migrations or restore deleted data.

## Support data handling

Never request or store passwords, OTPs, recovery links, API secrets, database URLs or service-role keys in tickets. Use redacted AWBs and timestamps. Keep customer shipment parties, addresses, financial details and uploaded documents out of public issue trackers.
