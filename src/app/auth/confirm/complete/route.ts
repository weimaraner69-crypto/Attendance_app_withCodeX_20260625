import { NextResponse } from 'next/server';

import { confirmStaffAuthLink } from '@/lib/auth/staff-auth-confirmation';
import { hasValidStaffAuthIdentity } from '@/lib/auth/staff-auth-identity';
import {
  clearStaffPasswordFlowGuard,
  generateStaffPasswordIntentToken,
  hashStaffPasswordIntentToken,
  setStaffPasswordIntentCookie,
  STAFF_PASSWORD_INTENT_TTL_SECONDS,
  startStaffPasswordFlowGuard,
} from '@/lib/auth/staff-password-intent';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return NextResponse.redirect(new URL('/auth/staff-password?invalid=1', request.url));
  }

  const form = await request.formData();
  const tokenHashEntry = form.get('token_hash');
  const typeEntry = form.get('type');
  const tokenHash = typeof tokenHashEntry === 'string' ? tokenHashEntry : '';
  const type = typeof typeEntry === 'string' ? typeEntry : '';
  const callbackUrl = new URL('/auth/confirm/complete', request.url);
  callbackUrl.searchParams.set('token_hash', tokenHash);
  callbackUrl.searchParams.set('type', type);

  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const result = await confirmStaffAuthLink(callbackUrl.toString(), {
    async verifyOtp(value, intentType) {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: value, type: intentType });
      return error ? null : data.user?.id ?? null;
    },
    hasValidStaffIdentity: (userId) => hasValidStaffAuthIdentity(admin, userId),
    startFlowGuard: startStaffPasswordFlowGuard,
    clearFlowGuard: clearStaffPasswordFlowGuard,
    async signOut() {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      return !error;
    },
    async createIntent(userId, intentType) {
      const consumedAt = new Date().toISOString();
      const { error: cleanupError } = await admin
        .from('staff_password_intents')
        .update({ consumed_at: consumedAt })
        .eq('user_id', userId)
        .is('consumed_at', null);
      if (cleanupError) return false;

      const token = generateStaffPasswordIntentToken();
      const expiresAt = new Date(Date.now() + STAFF_PASSWORD_INTENT_TTL_SECONDS * 1000).toISOString();
      const { error } = await admin.from('staff_password_intents').insert({
        user_id: userId,
        token_hash: hashStaffPasswordIntentToken(token),
        intent_type: intentType,
        expires_at: expiresAt,
        consumed_at: null,
      });
      if (error) return false;
      setStaffPasswordIntentCookie(token);
      return true;
    },
  });

  const destination = result.ok
    ? new URL('/auth/staff-password', request.url)
    : new URL('/auth/staff-password?invalid=1', request.url);
  return NextResponse.redirect(destination);
}
