'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const started = useRef(false);
  const [message, setMessage] = useState('Confirming your email address...');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const completeConfirmation = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(
          window.location.hash.replace(/^#/, '')
        );

        const providerError =
          params.get('error_description') ||
          hashParams.get('error_description') ||
          params.get('error') ||
          hashParams.get('error');

        if (providerError) {
          throw new Error(providerError.replace(/\+/g, ' '));
        }

        const code = params.get('code');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (!data.session) {
          throw new Error(
            'The confirmation link is invalid, expired, or has already been used. Please request a new confirmation email.'
          );
        }

        const { error: signOutError } = await supabase.auth.signOut({
          scope: 'local',
        });

        if (signOutError) throw signOutError;

        router.replace('/login?confirmed=1');
      } catch (error) {
        console.error('Email confirmation error:', error);
        setMessage(
          error instanceof Error
            ? error.message
            : 'We could not confirm your email address. Please try again.'
        );
        setHasError(true);
      }
    };

    void completeConfirmation();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">
          {hasError ? 'Email confirmation failed' : 'Verifying your email'}
        </h1>

        <p className="text-sm text-gray-600">{message}</p>

        {hasError && (
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md px-5 py-2.5 bg-black text-white"
          >
            Return to login
          </Link>
        )}
      </div>
    </main>
  );
}