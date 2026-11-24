import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Employees",
  description: "Manage employee access and roles within your LogiFlow company workspace.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function PageMetadataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
