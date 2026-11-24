import Link from 'next/link';
import { Package, ArrowRight, ShieldCheck, Zap, Globe, CheckCircle } from 'lucide-react';
import type { Metadata } from 'next';
import { MobileStickyCta } from '@/components/mobile-sticky-cta';

export const metadata: Metadata = {
  title: 'Logistics operations, connected',
  description: 'Bring shipment records, handovers, documents and finance workflows together in one secure workspace for freight forwarders and clearing teams.',
  alternates: { canonical: '/' },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <Package size={20} strokeWidth={2.5} />
            </div>
            <span className="text-xl font-extrabold text-slate-900 tracking-tight">LogiFlow</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
              Log In
            </Link>
            {/* FIXED: Changed href back to /signup */}
            <Link href="/signup" className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 transition-all">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-24 px-4 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6 ring-1 ring-indigo-200">
          <Zap size={14} /> A connected workspace for logistics teams
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          Bring every shipment, handover and update into one workspace.
        </h1>
        <p className="text-lg md:text-xl text-slate-500 mb-10 max-w-2xl mx-auto font-medium leading-relaxed">
          LogiFlow is the all-in-one platform for freight forwarders and clearing agents. Automate handovers, track payments, and manage your RFS and Operations teams from a single dashboard.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/signup" className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-4 rounded-xl text-lg font-bold shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
            Start Your Free Setup <ArrowRight size={20} />
          </Link>
          <Link href="/login" className="w-full sm:w-auto bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-xl text-lg font-bold shadow-sm hover:bg-slate-50 transition-all">
            Access Your Workspace
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-white border-y border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-slate-900">Everything you need to run operations</h2>
            <p className="text-slate-500 mt-2 font-medium">Built for Customer Service, Finance, Freight, and Operations teams.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: ShieldCheck, title: "Role-Based Security", desc: "Hide financials from RFS. Restrict deletion to Admins. Every user sees exactly what they need." },
              { icon: Globe, title: "Shipment Visibility", desc: "Timely manual status updates help the right teams stay aligned as shipments move through each milestone." },
              { icon: CheckCircle, title: "Document Management", desc: "Upload customs forms, commercial invoices, and proof of pickup directly to the AWB." }
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 pb-24 text-center text-sm font-medium text-slate-500 sm:pb-8" suppressHydrationWarning>
        <p>&copy; 2026 LogiFlow. All rights reserved.</p>
        <nav aria-label="Legal" className="mt-3 flex justify-center gap-5">
          <Link href="/privacy" className="hover:text-indigo-600 hover:underline">Privacy policy</Link>
          <Link href="/terms" className="hover:text-indigo-600 hover:underline">Terms of service</Link>
        </nav>
      </footer>
      <MobileStickyCta />
    </div>
  );
}