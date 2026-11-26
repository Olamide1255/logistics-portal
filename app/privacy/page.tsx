import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'How LogiFlow handles account, company, shipment, document and product-usage information.',
  alternates: { canonical: '/privacy' },
  openGraph: { type: 'website', title: "Privacy policy | LogiFlow", description: "How LogiFlow handles account, company, shipment, document and product-usage information.", images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title: "Privacy policy | LogiFlow", description: "How LogiFlow handles account, company, shipment, document and product-usage information.", images: ['/twitter-image'] },

};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-800 sm:px-6">
      <article className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 lg:p-14">
        <Link href="/" className="text-sm font-bold text-indigo-600 hover:underline">← LogiFlow home</Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Legal</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-950">Privacy policy</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated: 24 November 2026</p>
        <div className="legal-content mt-10 max-w-none">
          <p>This policy explains how LogiFlow processes information when you visit the website or use the logistics operations platform. It is written for a business service used by freight forwarders, clearing agents and their authorised teams.</p>
          <h2>1. Who is responsible for the information?</h2>
          <p>For account registration, platform administration, service security and website analytics, the LogiFlow service operator acts as the responsible organisation. For shipment, customer, consignee, document and operational information entered by a subscribing company, that company generally determines why the information is used and who may access it. LogiFlow processes that information to provide the service and follows the applicable customer instructions and service agreement.</p>
          <p>Users should contact their own company administrator first about shipment or customer records stored in their company workspace.</p>
          <h2>2. Information we process</h2>
          <ul>
            <li>Account and identity details such as name, business email, role and authentication records.</li>
            <li>Company profile details and employee invitations or access settings.</li>
            <li>Operational records entered by a company, including shipment references, milestones, routes, clients, payment status and related documents.</li>
            <li>Security, audit, diagnostic and service-availability information needed to protect and operate the platform.</li>
            <li>Basic website usage information only where a visitor has accepted optional analytics.</li>
          </ul>
          <p>Do not enter information that your organisation is not authorised to process or share with the platform.</p>
          <h2>3. Why we use information</h2>
          <p>We use information to create and administer accounts, provide shipment and workflow features, manage role-based access, deliver transactional messages, maintain auditability, protect the service, troubleshoot faults and improve the product. We do not use shipment or financial records as advertising audiences.</p>
          <h2>4. Service providers</h2>
          <p>The platform uses Supabase for authentication, database, file storage and rate limiting, and Vercel for application hosting and delivery. Supabase currently provides its default restricted email service for project testing; it is not suitable for general public customer onboarding. Resend is a planned email transport only and will be used through Supabase custom SMTP after a sending domain is verified and delivery is tested. PostHog receives consented, minimised browser product analytics and limited server-side diagnostic logs when the relevant application release and configuration are active.</p>
          <p>Service providers process information under their applicable terms and security controls. When configured, PostHog also receives limited server-side diagnostic error logs containing a generic error label and route/method metadata. These operational logs are separate from optional browser analytics and are used for service reliability and security; they do not include raw exception messages, stacks, account identifiers, shipment contents, cookies or request headers.</p>
          <h2>5. Cookies and analytics choices</h2>
          <p>Essential storage supports authentication, security and core application functions. Optional PostHog browser analytics are not loaded unless you accept analytics cookies. If you reject optional analytics, the browser analytics SDK is not loaded. Limited server-side diagnostic error logs, when configured and enabled in the deployed application, are processed separately for service reliability and security and do not depend on the browser analytics choice. You can change your browser analytics choice at any time using the Privacy settings control on the website. Session replay and automatic click capture are disabled.</p>
          <h2>6. Sharing and international processing</h2>
          <p>Information may be processed by the service providers listed above, by the company that invited you, or where disclosure is required by law or necessary to protect the service and its users. Providers may process information in locations outside Nigeria. The service operator and subscribing companies should apply appropriate contractual and organisational safeguards for cross-border processing where required.</p>
          <h2>7. Retention and security</h2>
          <p>Information is retained for as long as needed to provide the service, meet customer instructions, maintain security and audit records, resolve disputes, and comply with legal obligations. Retention periods may differ by data type and customer agreement. We use role-based access, tenant separation, private document storage and technical monitoring, but no internet service can guarantee absolute security.</p>
          <h2>8. Your rights</h2>
          <p>Depending on the applicable law and your relationship with the relevant company, you may have rights to request access, correction, deletion, restriction or objection to processing, and to complain to the Nigeria Data Protection Commission. For shipment or customer information, contact the company that controls the workspace. For your LogiFlow account or website information, use the support contact supplied with your service agreement or account onboarding.</p>
          <h2>9. Children</h2>
          <p>LogiFlow is a business service and is not designed for children.</p>
          <h2>10. Changes and contact</h2>
          <p>We may update this policy when the service or applicable requirements change. The latest version will be published on this page. For privacy questions, contact the service operator using the support contact provided with your LogiFlow service agreement.</p>
          <p className="text-sm text-slate-500">This policy describes the current product design and configured providers. It is not legal advice and should be reviewed against the final operating entity, contracts, retention schedule and data-processing arrangements before commercial launch.</p>
        </div>
        <div className="mt-10 flex flex-wrap gap-4 border-t border-slate-100 pt-6 text-sm"><Link href="/terms" className="font-semibold text-indigo-600 hover:underline">Terms of service</Link><Link href="/signup" className="font-semibold text-indigo-600 hover:underline">Create a workspace</Link></div>
      </article>
    </main>
  );
}
