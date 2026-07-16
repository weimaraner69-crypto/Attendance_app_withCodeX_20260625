import { NextResponse } from 'next/server';

import { confirmStaffAuthLink } from '@/lib/auth/staff-auth-confirmation';
import { hasValidStaffAuthIdentity } from '@/lib/auth/staff-auth-identity';
import {
  generateStaffPasswordIntentToken,
  hashStaffPasswordIntentToken,
  setStaffPasswordIntentCookie,
  STAFF_PASSWORD_INTENT_TTL_SECONDS,
} from '@/lib/auth/staff-password-intent';
import {
  createSupabaseAdminClient,
  createSupabaseTransientAuthClient,
} from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return NextResponse.redirect(
      new URL('/auth/staff-password?invalid=1', request.url),
      303
    );
  }

  const form = await request.formData();
  const tokenHashEntry = form.get('token_hash');
  const typeEntry = form.get('type');
  const tokenHash = typeof tokenHashEntry === 'string' ? tokenHashEntry : '';
  const type = typeof typeEntry === 'string' ? typeEntry : '';
  const callbackUrl = new URL('/auth/confirm/complete', request.url);
  callbackUrl.searchParams.set('token_hash', tokenHash);
  callbackUrl.searchParams.set('type', type);

  const supabase = createSupabaseTransientAuthClient();
  const admin = createSupabaseAdminClient();
  const result = await confirmStaffAuthLink(callbackUrl.toString(), {
    async verifyOtp(value, intentType) {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: value, type: intentType });
      return error ? null : data.user?.id ?? null;
    },
    hasValidStaffIdentity: (userId) => hasValidStaffAuthIdentity(admin, userId),
    async createIntent(userId, intentType) {
      const token = generateStaffPasswordIntentToken();
      const expiresAt = new Date(Date.now() + STAFF_PASSWORD_INTENT_TTL_SECONDS * 1000).toISOString();
      const { error } = await admin.rpc('issue_staff_password_intent', {
        p_user_id: userId,
        p_token_hash: hashStaffPasswordIntentToken(token),
        p_intent_type: intentType,
        p_expires_at: expiresAt,
      });
      if (error) return false;
      setStaffPasswordIntentCookie(token);
      return true;
    },
  });

  const destination = result.ok
    ? new URL('/auth/staff-password', request.url)
    : new URL('/auth/staff-password?invalid=1', request.url);
  return NextResponse.redirect(destination, 303);
}
