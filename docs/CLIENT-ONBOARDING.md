# Client onboarding guide

## Before inviting external companies

1. Confirm that the production Supabase Auth email provider has **Confirm Email** enabled.
2. Configure and test custom SMTP for the Supabase project. Supabase's hosted default email service is limited to addresses belonging to members of the Supabase organization; it is not sufficient for sending invitations to arbitrary client domains. Custom SMTP configuration is included in the Supabase Free plan, but you still need an email provider account and its credentials.
3. Verify that the production application URL is in Supabase Auth's allowed redirect URL list. Set `NEXT_PUBLIC_SITE_URL` to the trusted production origin when using a custom domain; local development defaults to `http://localhost:3000`.
4. Send a test signup confirmation and a test employee invitation to an external mailbox before onboarding a real tenant.

The self-service signup endpoint now creates an unconfirmed administrator and sends a signup confirmation email. The company Super Admin cannot sign in until the address is verified. If email delivery fails, the endpoint cleans up the partially created user, profile and company instead of leaving an unusable workspace.

## Option A: self-service workspace registration

1. Open `/signup`.
2. Enter the legal/company display name (2–120 characters), the first administrator's email and a unique passphrase of at least 12 characters.
3. Submit the form. The API creates an Active company and a Super Admin profile, then sends an email confirmation.
4. Open the confirmation email and follow its link.
5. Sign in at `/login`.
6. Open Company Settings and complete the company's profile and logo.
7. Open Employee Management and invite the relevant team members.

Signup is rate-limited to three attempts per IP per hour. Do not ask a customer to send a password or verification code to support.

## Option B: Platform Admin-assisted onboarding

1. A Platform Admin opens `/platform`.
2. Create the tenant company and provide the first Super Admin's email.
3. Send the invitation.
4. The recipient follows the invitation email to confirm the address and finish account setup.
5. The new Super Admin signs in and completes company settings.
6. The Super Admin invites the rest of the team.

Invitation delivery depends on the production Supabase Auth email provider and custom SMTP configuration.

## Employee roles

Invite employees from **Dashboard → Employees**. Select the least-privileged role required for the person's duties:

- Customer Service: shipment registration and shipment detail corrections.
- Finance: payment recording, client financials and finance reports.
- Freight: shipment registration and booking.
- RFS: pickup and handover to Operations.
- Operations: export clearance and airline handover.

Company Super Admin access is assigned by a Platform Admin. Tenant Super Admins can update ordinary employee roles and departments, but cannot promote users to Super Admin or Platform Admin.

## First-workspace checklist

- [ ] Confirm company name and logo.
- [ ] Confirm the first Super Admin can sign in.
- [ ] Invite at least one user for each department the company actually uses.
- [ ] Check that each invitee receives and accepts the invitation.
- [ ] Add client records and verify contact details.
- [ ] Register a test shipment and check the AWB.
- [ ] Enter expected delivery and payment due dates where applicable; reports depend on these fields.
- [ ] Test the correct Freight → RFS → Operations workflow.
- [ ] Record a test payment only in staging; never create dummy financial entries in a live tenant.
- [ ] Open the public tracking link and confirm it exposes only intended tracking information.
- [ ] Confirm the company Super Admin knows how to contact platform support.

## Support and account safety

Support staff must never request passwords, one-time codes, recovery links, service-role keys or database credentials. For troubleshooting, request a timestamp, affected page, role, redacted AWB/reference and a short description. Remove personal, financial and shipment-party details from screenshots before sharing them.
