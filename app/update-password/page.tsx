import type { Metadata } from 'next';
import UpdatePasswordForm from '@/components/auth/update-password-form';
export const metadata: Metadata = { title: 'Choose a new password', description: 'Set a new secure password for your LogiFlow account.', robots: { index: false, follow: false } };
export default function UpdatePasswordPage() { return <UpdatePasswordForm />; }
