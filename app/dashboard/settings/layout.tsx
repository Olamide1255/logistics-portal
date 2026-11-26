import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Company settings",
  description: "Manage your company profile, branding and workspace preferences.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function PageMetadataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
