import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of service',
  description: 'Terms for accessing and using the LogiFlow logistics operations platform.',
  alternates: { canonical: '/terms' },
  openGraph: { type: 'website', title: "Terms of service | LogiFlow", description: "Terms for accessing and using the LogiFlow logistics operations platform.", images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title: "Terms of service | LogiFlow", description: "Terms for accessing and using the LogiFlow logistics operations platform.", images: ['/twitter-image'] },

};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-800 sm:px-6">
      <article className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 lg:p-14">
        <Link href="/" className="text-sm font-bold text-indigo-600 hover:underline">â† LogiFlow home</Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Legal</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-950">Terms of service</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated: 24 November 2026</p>
        <div className="legal-content mt-10 max-w-none">
          <p>These terms govern access to the LogiFlow website and logistics operations platform. By creating an account or using a company workspace, you agree to follow these terms and any service agreement that applies to your organisation.</p>
          <h2>1. The service</h2>
          <p>LogiFlow provides a business workspace for managing logistics operations, shipment records, manual status updates, handovers, documents, employee access, notifications and reporting. Shipment information reflects records entered by authorised users and connected providers; the platform does not itself guarantee live GPS, airline-system or carrier-system tracking.</p>
          <h2>2. Accounts and access</h2>
          <p>You must provide accurate registration details, protect your sign-in credentials and keep employee access appropriate to each person&apos;s responsibilities. Company administrators are responsible for inviting and removing users, assigning roles and reviewing access. Do not share accounts or attempt to access another company&apos;s workspace.</p>
          <h2>3. Acceptable use</h2>
          <p>You must not misuse the service, interfere with its operation, bypass access controls, upload malicious content, attempt unauthorised access, or use the platform in violation of applicable law or another person&apos;s rights. We may restrict access where reasonably necessary to protect the service, users or data.</p>
          <h2>4. Customer data</h2>
          <p>Your organisation retains its rights in the business, shipment, customer and document information it submits. You are responsible for having the legal authority to enter and process that information and for providing any notices required to your employees, customers and other data subjects. You authorise the service operator to process the information as needed to provide, secure and support the platform.</p>
          <h2>5. Availability and changes</h2>
          <p>We aim to keep the service available and reliable, but maintenance, provider outages, network issues and security events may interrupt access. Features may be updated, changed or retired as the platform develops. We will take reasonable care when making changes that affect customer workflows.</p>
          <h2>6. Documents and operational decisions</h2>
          <p>Users are responsible for the accuracy and completeness of shipment, payment, customs, freight and delivery information they enter. Reports and exports are operational aids, not independent verification of a transaction or professional legal, tax, customs, accounting or financial advice. Verify critical decisions against authoritative records.</p>
          <h2>7. Intellectual property</h2>
          <p>The platform software, design and service materials are owned by or licensed to the service operator. Subject to these terms and any service agreement, you receive a limited, non-exclusive, non-transferable right to use the service for your organisation&apos;s internal business operations.</p>
          <h2>8. Suspension and termination</h2>
          <p>Access may be suspended or terminated where an account is compromised, these terms are materially breached, continued access creates a security or legal risk, or the applicable service agreement ends. Data export and deletion are subject to the service agreement, applicable law, security requirements and retention obligations.</p>
          <h2>9. Disclaimers and liability</h2>
          <p>To the extent permitted by applicable law, the service is provided on an as-available basis. We do not warrant uninterrupted operation or that user-entered operational data is accurate. Nothing in these terms excludes liability that cannot lawfully be excluded. Any agreed liability limits, fees, service levels or additional warranties must be set out in the applicable signed service agreement.</p>
          <h2>10. Governing law and updates</h2>
          <p>These terms are subject to applicable laws of the Federal Republic of Nigeria, except where a signed service agreement validly provides otherwise. We may update these terms as the platform changes. Continued use after an updated version takes effect constitutes acceptance where permitted by law.</p>
          <p className="text-sm text-slate-500">The final operating entity, registered address, formal notice contact, dispute-resolution process and any commercial service levels should be completed and reviewed by qualified Nigerian counsel before these terms are relied on for paid customer contracts.</p>
        </div>
        <div className="mt-10 flex flex-wrap gap-4 border-t border-slate-100 pt-6 text-sm"><Link href="/privacy" className="font-semibold text-indigo-600 hover:underline">Privacy policy</Link><Link href="/signup" className="font-semibold text-indigo-600 hover:underline">Create a workspace</Link></div>
      </article>
    </main>
  );
}
