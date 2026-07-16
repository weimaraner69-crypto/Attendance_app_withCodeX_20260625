import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase';

export async function hasValidStaffAuthIdentity(
  admin: SupabaseClient<Database>,
  userId: string
) {
  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('organization_id, role, is_active')
    .eq('id', userId)
    .eq('is_active', true)
    .maybeSingle();
  if (profileError || !profile || profile.role !== 'staff') return false;

  const { data: staff, error: staffError } = await admin
    .from('staff')
    .select('id')
    .eq('auth_user_id', userId)
    .eq('organization_id', profile.organization_id)
    .eq('is_active', true)
    .maybeSingle();
  return !staffError && Boolean(staff);
}
