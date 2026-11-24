import type { Metadata } from 'next';
import PlatformShell from '@/components/platform-shell';

export const metadata: Metadata = {
  title: { default: 'Platform console', template: '%s' },
  description: 'Private LogiFlow platform administration console.',
  robots: { index: false, follow: false, noarchive: true },
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>;
}
