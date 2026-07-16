import { NextResponse } from 'next/server';

import { confirmStaffAuthLink } from '@/lib/auth/staff-auth-confirmation';
import { startStaffPasswordIntent } from '@/lib/auth/staff-password-intent';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const result = await confirmStaffAuthLink(request.url, {
    async verifyOtp(tokenHash, type) {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      return error ? null : data.user?.id ?? null;
    },
    async hasValidStaffIdentity(userId) {
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
    },
    startIntent: startStaffPasswordIntent,
    async signOut() {
      await supabase.auth.signOut({ scope: 'local' });
    },
  });

  const destination = result.ok
    ? new URL('/auth/staff-password', request.url)
    : new URL('/auth/staff-password?invalid=1', request.url);
  return NextResponse.redirect(destination);
}
