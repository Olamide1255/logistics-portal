import type { Metadata } from 'next';
import DashboardShell from '@/components/dashboard-shell';

export const metadata: Metadata = {
  title: { default: 'Workspace', template: '%s' },
  description: 'Private LogiFlow company workspace.',
  robots: { index: false, follow: false, noarchive: true },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
