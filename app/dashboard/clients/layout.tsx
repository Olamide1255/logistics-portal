import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Clients",
  description: "Manage client records and company-level shipment and financial summaries.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function PageMetadataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
