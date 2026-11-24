import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Audit logs",
  description: "Review company-scoped activity and administrative audit records.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function PageMetadataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
