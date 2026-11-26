import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Reports",
  description: "Operational dashboards, delivery performance, receivables and financial summaries.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function PageMetadataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
