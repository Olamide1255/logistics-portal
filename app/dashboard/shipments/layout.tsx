import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Shipments",
  description: "Search and manage company shipment records and operational milestones.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function PageMetadataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
