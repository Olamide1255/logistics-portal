import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Auth's admin listUsers endpoint is paginated (50 by default).
 * Walk every page so account recovery and duplicate checks do not silently
 * miss identities created after the first page.
 */
export async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === normalizedEmail,
    );
    if (match) return match;

    if (data.users.length < perPage) return null;
  }
}
