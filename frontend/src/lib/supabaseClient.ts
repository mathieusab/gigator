import { createClient } from '@supabase/supabase-js';

let supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ??
  (process.env.VITE_SUPABASE_URL as string | undefined)) as string | undefined;
let supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ??
  (process.env.VITE_SUPABASE_ANON_KEY as string | undefined)) as string | undefined;

// In tests we allow a dummy client so modules can import cleanly.
if (!supabaseUrl || !supabaseAnonKey) {
  if (import.meta.env.MODE === 'test') {
    supabaseUrl = 'http://localhost';
    supabaseAnonKey = 'test-anon-key';
  } else {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
