import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Administration",
  description: "Manage administration settings for your LogiFlow workspace.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function PageMetadataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
