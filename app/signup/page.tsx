import type { Metadata } from 'next';
import SignupForm from '@/components/auth/signup-form';
export const metadata: Metadata = { title: 'Create your workspace', description: 'Set up a secure logistics operations workspace for your freight forwarding or clearing team.', alternates: { canonical: '/signup' } };
export default function SignupPage() { return <SignupForm />; }
