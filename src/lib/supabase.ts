import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Critical System Warning: Missing backend initialization credentials! Ensure your local .env file contains valid configuration variables.");
}

export const db = createClient(url || '', key || '');