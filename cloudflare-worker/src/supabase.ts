import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Bindings } from './types';

export function getSupabase(env: Bindings): SupabaseClient {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
