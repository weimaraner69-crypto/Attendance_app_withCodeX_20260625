import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from './env';

export function createSupabaseAdminClient(options?: { fetch?: typeof fetch }) {
  return createClient<Database>(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      ...(options?.fetch ? { global: { fetch: options.fetch } } : {}),
    }
  );
}
