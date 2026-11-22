# Role and permission matrix

This document describes the current authorization model. Database policies and workflow triggers are the enforcement layer; hiding a navigation link is not a security boundary.

## Tenant roles

| Capability | Customer Service | Finance | Freight | RFS | Operations | Super Admin |
|---|---:|---:|---:|---:|---:|---:|
| View own-company shipments and clients | Yes | Yes | Yes | Yes | Yes | Yes |
| Register shipments | Yes | No | Yes | No | No | Yes |
| Edit shipment details | Yes | No | No | No | No | Yes |
| Book a registered shipment | No | No | Yes | No | No | Yes |
| Record/approve shipment payments | No | Yes | No | No | No | Yes |
| View shipment financial details | Yes | Yes | Yes | No | No | Yes |
| View finance/client reports | No | Yes | No | No | No | Yes |
| View operational overview | Yes | Yes | Yes | Yes | Yes | Yes |
| RFS pickup and handover milestones | No | No | No | Yes | No | Yes |
| Export clearance and airline handover | No | No | No | No | Yes | Yes |
| Manage employees and company settings | No | No | No | No | No | Yes |
| View company audit logs | No | No | No | No | No | Yes |

Notes:

- Shipment workflow transitions are enforced by a database trigger, not just by the UI.
- Customer Service may edit shipment details but cannot change operational status.
- Finance may record payments and access finance reports but cannot advance operational shipment milestones.
- Freight books shipments; RFS records pickup and handover; Operations records clearance and airline handover.
- Payment recording is atomic with the shipment payment state and timeline. Full payment can approve the shipment automatically.
- Financial figures are kept separate by currency; no implicit FX conversion is performed.
- Tenant Super Admins can manage regular employee roles. Assignment of a company Super Admin role is reserved for a Platform Admin. The employee UI now reflects this restriction.

## Platform Admin

Platform Admin is a separate global role, not a tenant employee role.

- Can access platform-wide tenant health and company onboarding.
- Can appoint a company's Super Admin.
- Has platform-level access to tenant records and shipment details.
- Cannot use the tenant Finance/Operations report RPC; tenant reports remain scoped to Finance and tenant Super Admin.
- Must be treated as a highly privileged operator account.

## Verification performed

Rollback-only SQL tests were run against the isolated staging project using synthetic Tenant Alpha and Tenant Beta fixtures. The same synthetic tenant identity was temporarily assigned each tenant role inside a transaction; all changes were rolled back.

Verified outcomes:

- All six tenant roles saw only their own tenant's shipment and client records.
- Platform Admin could see platform-wide tenant health; a tenant Finance user was denied that RPC.
- Finance and tenant Super Admin could access the finance/operations report and client report RPCs. Other tenant roles were denied those report RPCs.
- The role-specific shipment actions were exercised for Customer Service, Finance, Freight, RFS, Operations and Super Admin. Finance's payment recording and automatic full-payment approval path was exercised separately.
- The valid end-to-end status path (Freight booking → RFS pickup/handover → Operations clearance/airline handover → Super Admin delivery) succeeded inside a rollback-only transaction.
- Invalid transitions were rejected by the database.
- Cross-tenant shipment and client reads returned only Tenant Alpha fixtures for the Tenant Alpha identity.

## Browser verification status

The repository contains Playwright smoke tests and two authenticated staging journeys (Platform Admin and Customer Service). On the 22 November 2026 production release, the authenticated Playwright job was skipped because its dedicated staging password secrets were not configured. The project owner explicitly waived those browser journeys for that release.

Therefore, database authorization and workflow checks are verified, but authenticated browser journeys for each role are not yet signed off. Do not describe all role-based UI journeys as passed until dedicated staging identities and credentials are configured and those tests complete.
