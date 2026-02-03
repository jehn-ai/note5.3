import { createClient } from '@supabase/supabase-js';

// Accessing environment variables defined in .env.local
// We use logical OR to provide fallbacks for environments where process.env is not automatically populated.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Critical Error: Supabase configuration missing.');
  throw new Error('Supabase URL and Key are required. Please check lib/supabase.ts or your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
