import { createClient } from '@supabase/supabase-js';

// Accessing environment variables defined in .env.local
// We use logical OR to provide fallbacks for environments where process.env is not automatically populated.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wrgmwngwfwwyutqtxyhf.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndyZ213bmd3Znd3eXV0cXR4eWhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3ODUyMDUsImV4cCI6MjA4NTM2MTIwNX0.XyfTt6m4jujuSlrOqEO0JTzm3Ixb_YQNRnkl11QGOTM';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Critical Error: Supabase configuration missing.');
  throw new Error('Supabase URL and Key are required. Please check lib/supabase.ts or your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
