import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gexcsnwztzajoupgjhpc.supabase.co';
let supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Verified production anon key for project gexcsnwztzajoupgjhpc
const VALID_PROD_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdleGNzbnd6dHpham91cGdqaHBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMTg1NjgsImV4cCI6MjA5NTU5NDU2OH0.n1PSB_3T6dzvsnWnKNkD5BXKJHGfcseVOuN5Fut1t0I';

// Fallback if Vercel env variable was pasted incompletely (e.g. truncated without header or signature)
if (!supabaseAnonKey || supabaseAnonKey.split('.').length !== 3) {
  supabaseAnonKey = VALID_PROD_ANON_KEY;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Backward compatibility alias
export const db = supabase;