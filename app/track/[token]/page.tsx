import type { Metadata } from 'next';
import TrackingPage from '@/components/tracking-page';

export const metadata: Metadata = {
  title: 'Shipment tracking',
  description: 'View the latest shipment milestones shared by your logistics provider.',
  robots: { index: false, follow: false, noarchive: true },
};

export default function PublicTrackingPage() { return <TrackingPage />; }
