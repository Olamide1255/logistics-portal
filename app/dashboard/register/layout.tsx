import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Register a shipment",
  description: "Create and register a shipment in your company workspace.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function PageMetadataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
