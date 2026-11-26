import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Shipment details",
  description: "Review shipment milestones, documents, actions and authorised financial details.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function PageMetadataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
