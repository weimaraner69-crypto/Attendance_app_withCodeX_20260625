import { createClient } from '@supabase/supabase-js';

import type { Database } from './database.types';
import { getSupabaseAnonKey, getSupabaseUrl } from './env';

export function createSupabaseTransientAuthClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
