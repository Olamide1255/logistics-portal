import { createClient } from '@supabase/supabase-js';

const AUTH_STORAGE_PREFERENCE = 'logiflow-auth-persistence';

const authStorage = {
  getItem(key: string) {
    if (typeof window === 'undefined') return null;

    const useSessionStorage =
      window.localStorage.getItem(AUTH_STORAGE_PREFERENCE) === 'session';

    return useSessionStorage
      ? window.sessionStorage.getItem(key)
      : window.localStorage.getItem(key);
  },

  setItem(key: string, value: string) {
    if (typeof window === 'undefined') return;

    const useSessionStorage =
      window.localStorage.getItem(AUTH_STORAGE_PREFERENCE) === 'session';

    if (useSessionStorage) {
      window.localStorage.removeItem(key);
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
      window.localStorage.setItem(key, value);
    }
  },

  removeItem(key: string) {
    if (typeof window === 'undefined') return;

    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: authStorage,
    },
  }
);

// Capture password recovery as soon as the browser client is initialized.
let passwordRecoveryDetected = false;

if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      passwordRecoveryDetected = true;

      try {
        window.sessionStorage.setItem('logiflow-password-recovery', '1');
      } catch {
        // The in-memory flag remains available if sessionStorage is blocked.
      }
    } else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      passwordRecoveryDetected = false;

      try {
        window.sessionStorage.removeItem('logiflow-password-recovery');
      } catch {
        // Ignore unavailable sessionStorage.
      }
    }
  });
}

export function hasPasswordRecovery() {
  if (passwordRecoveryDetected) return true;

  if (typeof window === 'undefined') return false;

  try {
    return window.sessionStorage.getItem('logiflow-password-recovery') === '1';
  } catch {
    return false;
  }
}

export function clearPasswordRecovery() {
  passwordRecoveryDetected = false;

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem('logiflow-password-recovery');
    } catch {
      // Ignore unavailable sessionStorage.
    }
  }
}
