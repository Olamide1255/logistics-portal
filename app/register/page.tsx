import { redirect } from 'next/navigation';

// Preserve old bookmarks without exposing the retired test-only registration form.
export default function LegacyRegisterRedirect() {
  redirect('/dashboard/register');
}
