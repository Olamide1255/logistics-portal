# Product Direction and Experience Roadmap

## Product vision

Build a dependable, multi-tenant logistics operations platform that gives freight forwarders and logistics companies one clear place to manage shipments, customers, money, documents, teams, service delivery, and business performance.

The product should earn retention through operational value, reliable information, excellent service workflows, and trustworthy reporting. It must not rely on artificial lock-in: customers should retain appropriate access to their records and exports.

## Target users and their jobs

| Persona | Primary job | Product value |
| --- | --- | --- |
| Business owner / executive | Understand business health and make decisions | Revenue and receivables visibility, shipment trends, client concentration, delivery performance |
| Operations manager | Keep shipments moving | Live work queues, ageing and exception alerts, handover visibility, workload |
| Finance | Collect and reconcile money | Invoices, payment ledger, receivables ageing, currency-safe financial reports |
| Customer service | Keep clients informed | Client history, shipment timeline, communication log, issue ownership |
| Freight / RFS operator | Execute operational milestones | Booking, airline/agent handover, pickup and dispatch schedules |
| Shipper / consignee | Know where a shipment is and what is needed | Secure tracking, milestone updates, documents, clear next steps and support |

## Product principles

1. **Trust before novelty.** Correct shipment state, financial figures, tenant boundaries, and audit history matter more than decorative features.
2. **Role-aware, not role-fragmented.** Every role gets a focused workspace while shared shipment context remains consistent.
3. **Exception-first operations.** Surface overdue, blocked, missing-document, unpaid, and at-risk shipments before routine work.
4. **Fast common workflows.** Search, register, update, comment, upload, record payments, and export should require minimal navigation.
5. **Tenant-safe by design.** Every query, report, export, notification, and file operation must remain scoped to the authenticated company.
6. **Mobile-capable and resilient.** Core views should work on smaller screens and communicate offline or sync states clearly.
7. **Transparent financial reporting.** Never sum different currencies as if they were equivalent. Preserve currency or convert using a stated rate and date.
8. **Accessible and consistent.** Keyboard support, visible focus, clear labels, readable contrast, helpful empty/error/loading states, and consistent components.
9. **Retention through usefulness.** Build repeatable workflows, accurate reporting, customer communication, and integrations; do not obstruct legitimate data export.

## Current product baseline observed in the repository

- Tenant dashboard currently fetches the shipment collection into the browser and calculates its KPI cards and work queue from the returned rows. This is not a safe foundation for complete, scalable reporting because the result can be limited by the database client's row cap.
- Shipment list already has server-side filtering and pagination, but has a basic search/table experience and limited filters.
- Shipment detail has timeline, comments, documents, payments, and realtime updates: a useful foundation for a shipment workspace.
- Registration currently checks role using email-prefix conventions in the client UI, while other areas use profile roles. Replace this with consistent profile-based role checks and rely on database/API authorization as the real boundary.
- Client Reports derives totals from nested shipment/payment data and displays a naira symbol. It needs explicit currency grouping, complete pagination/aggregation, and a report definition that avoids silently mixing currencies.
- The tenant navigation has no dedicated reports centre or owner/manager analytics workspace.
- Platform administration currently focuses on tenant onboarding, status, and high-level counts; it will need operational health and tenant-support visibility as the platform matures.

These observations are repository review findings, not a claim that authenticated user journeys have been tested.

## Proposed information architecture

### Tenant workspace
- Overview
- Shipments
- Register shipment
- Clients
- Finance
- Reports
- Team and workload
- Documents
- Settings
- Audit activity

Visibility and actions must be controlled by trusted role and tenant permissions. A navigation item being hidden is not authorization.

### Platform administration
- Platform overview
- Tenant directory and onboarding
- Tenant health and usage
- Support and audit trail
- Subscription administration (later phase; billing lifecycle remains last)

### Customer-facing experience (later phase)
- Branded tracking page
- Secure customer portal
- Shipment milestone notifications
- Document sharing with explicit permissions
- Support requests linked to a shipment

## Dashboard and reporting blueprint

### Executive overview
- Shipments created and completed over a selected period
- Active shipments by operational stage
- Revenue / billed amount and collections, grouped by currency
- Outstanding receivables and ageing buckets
- On-time delivery rate and average transit duration where milestone data supports it
- Top clients and route/service mix
- Exceptions requiring management attention

### Operations workspace
- Queue by stage and assigned team
- Ageing shipments and time spent in each stage
- Delayed / at-risk shipments with reason and owner
- Upcoming pickups, bookings, handovers, and delivery milestones
- Missing documents and unresolved client issues
- Workload by team member, using transparent and fair definitions

### Finance workspace
- Amount billed, amount collected, and outstanding balance by currency
- Receivables ageing (for example: current, 1–30, 31–60, 61–90, 90+ days) once invoice due dates are modelled
- Payment ledger and reconciliation status
- Unallocated payments, partial payments, and overpayments
- CSV/PDF exports with date, currency, tenant, and filter context

### Client intelligence
- Shipment count and value by client and currency
- Repeat-client activity and trend
- Outstanding balance and payment timeliness
- Service type, route, and shipment mix
- Client activity history and service issues

### Reports centre
- Date range and timezone-aware filters
- Filters for client, route, origin/destination, import/export, service type, status, airline, and currency where data exists
- Saved views and repeatable report definitions
- CSV export first; polished PDF output after report calculations are trustworthy
- Report metadata: generated-at time, selected filters, currency, and data scope
- Permission checks applied server-side to both report data and exports

## Delivery roadmap

### Phase 0 — Baseline, correctness, and safety
- Complete route-by-route security and authorization review.
- Resolve the Next.js / eslint-config-next major-version mismatch with a lockfile regenerated by the package manager and CI verification.
- Review IP-based rate-limit identity and trust only proxy headers guaranteed by the deployment platform.
- Replace inconsistent client-side role checks with profile-derived UI permissions; retain database/API checks.
- Add regression tests for tenant isolation, authorization, workflow transitions, and financial edge cases.
- Complete authenticated browser testing when test credentials and the user's PC are available.

### Phase 1 — Reporting foundation
- Define shipment and financial metric semantics before presenting them.
- Identify required indexes and tenant-safe aggregation strategy.
- Implement server-side / database-side aggregations with explicit company scope.
- Support pagination, date filters, and currency-separated totals.
- Add report API tests for cross-tenant access, empty data, large datasets, timezone boundaries, partial payments, and multiple currencies.

### Phase 2 — Executive and operational dashboards
- Replace client-side all-row dashboard aggregation.
- Add role-aware executive, operations, and finance views.
- Add exception-first queues, ageing, trends, and clear drill-downs.
- Provide loading skeletons, empty states, refresh behavior, and accessible responsive layouts.

### Phase 3 — Reporting centre and client intelligence
- Add report catalogue, filter builder, saved views, and exports.
- Improve client reports with complete server-side aggregates and currency-safe totals.
- Add client activity, repeat-business, and receivables insights.
- Validate exported figures against source records.

### Phase 4 — Customer experience and workflow differentiation
- Branded public shipment tracking with carefully limited data exposure.
- Secure customer portal and controlled document access.
- Shipment milestone notifications and communication history.
- Exception and service-request workflows.
- Integration points (email, messaging, accounting, carrier/airline feeds) only where reliability, consent, and supportability are clear.

### Phase 5 — Platform scale and commercial operations
- Tenant usage and health analytics.
- Operational support tooling and auditability.
- Performance and capacity tests with realistic synthetic datasets.
- Billing lifecycle only after core product, security, and reporting workflows are validated.

## UX quality bar

Every major screen should provide:
- Clear page purpose and primary action.
- Consistent spacing, typography, status language, and component behavior.
- Search and filters that remain usable on mobile.
- Useful skeletons, empty states, error recovery, and confirmation for destructive actions.
- Clear timestamps and ownership for operational work.
- Accessible keyboard focus and semantic labels.
- Fast navigation and no unnecessary full-page reloads.
- No misleading metrics or unexplained currency conversions.

## Acceptance criteria for reporting

A report is not ready until:
1. Its metric definitions are documented.
2. It is scoped to the authenticated tenant on the server/database side.
3. Large datasets are aggregated without loading every row into the browser.
4. Date boundaries and timezone are explicit.
5. Currency is preserved or conversion basis is shown.
6. CSV/PDF totals reconcile with source records.
7. Unauthorized and cross-tenant tests fail safely.
8. Loading, empty, error, and export states are tested.

## Delivery safeguards

- Work in isolated branches and pull requests.
- Do not merge failing checks.
- Do not run production migrations for reporting until staging parity and tenant-isolation tests pass.
- Keep production data unchanged during discovery and synthetic testing.
- Do not claim authenticated browser coverage until those journeys have actually run.
- Keep billing lifecycle out of scope until the preceding phases are validated.
