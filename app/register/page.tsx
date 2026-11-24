import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Registration moved', robots: { index: false, follow: false } };\n\n// Preserve old bookmarks without exposing the retired test-only registration form.
export default function LegacyRegisterRedirect() {
  redirect('/dashboard/register');
}
