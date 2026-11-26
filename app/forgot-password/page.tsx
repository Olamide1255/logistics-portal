import type { Metadata } from 'next';
import ForgotPasswordForm from '@/components/auth/forgot-password-form';
export const metadata: Metadata = { title: 'Reset your password', description: 'Request a secure password reset link for your LogiFlow account.', robots: { index: false, follow: false } };
export default function ForgotPasswordPage() { return <ForgotPasswordForm />; }
