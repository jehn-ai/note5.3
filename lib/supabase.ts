import { createClient } from '@supabase/supabase-js';

// Accessing environment variables defined in .env.local
// We use logical OR to provide fallbacks for environments where process.env is not automatically populated.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Critical Error: Supabase configuration missing.');
  throw new Error('Supabase URL and Key are required. Please check lib/supabase.ts or your environment variables.');
}

const customStorage = {
  getItem: (key: string) => {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    // Check our custom "Remember Me" flag
    const rememberMe = localStorage.getItem('notegenie_remember_me') === 'true';
    if (rememberMe) {
      localStorage.setItem(key, value);
    } else {
      sessionStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
