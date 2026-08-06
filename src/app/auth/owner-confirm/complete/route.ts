import { NextResponse } from 'next/server';

import { confirmOwnerPasswordRecoveryLink } from '@/lib/auth/owner-auth-confirmation';
import { hasValidOwnerAuthIdentityForUser } from '@/lib/auth/owner-auth-identity';
import { createOwnerAuthIdentityOperations } from '@/lib/auth/owner-auth-operations';
import {
  clearOwnerPasswordIntent,
  generateOwnerPasswordIntentToken,
  hashOwnerPasswordIntentToken,
  OWNER_PASSWORD_INTENT_TTL_SECONDS,
  setOwnerPasswordIntentCookie,
} from '@/lib/auth/owner-password-intent';
import {
  createSupabaseAdminClient,
  createSupabaseTransientAuthClient,
} from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  clearOwnerPasswordIntent();
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin !== new URL(request.url).origin) {
    return NextResponse.redirect(new URL('/auth/owner-password?invalid=1', request.url), 303);
  }

  const form = await request.formData();
  const tokenHashEntry = form.get('token_hash');
  const typeEntry = form.get('type');
  const tokenHash = typeof tokenHashEntry === 'string' ? tokenHashEntry : '';
  const type = typeof typeEntry === 'string' ? typeEntry : '';
  const callbackUrl = new URL('/auth/owner-confirm/complete', request.url);
  callbackUrl.searchParams.set('token_hash', tokenHash);
  callbackUrl.searchParams.set('type', type);

  const auth = createSupabaseTransientAuthClient();
  const admin = createSupabaseAdminClient();
  const identityOperations = createOwnerAuthIdentityOperations(admin);
  const result = await confirmOwnerPasswordRecoveryLink(callbackUrl.toString(), {
    async verifyRecoveryOtp(value) {
      const { data, error } = await auth.auth.verifyOtp({
        token_hash: value,
        type: 'recovery',
      });
      return error ? null : data.user?.id ?? null;
    },
    hasValidOwnerIdentity: (userId) => (
      hasValidOwnerAuthIdentityForUser(userId, identityOperations)
    ),
    async createIntent(userId) {
      const token = generateOwnerPasswordIntentToken();
      const expiresAt = new Date(
        Date.now() + OWNER_PASSWORD_INTENT_TTL_SECONDS * 1000
      ).toISOString();
      const { error } = await admin.rpc('issue_owner_password_recovery_intent', {
        p_user_id: userId,
        p_token_hash: hashOwnerPasswordIntentToken(token),
        p_expires_at: expiresAt,
      });
      if (error) return false;
      setOwnerPasswordIntentCookie(token);
      return true;
    },
  });

  const destination = result.ok
    ? new URL('/auth/owner-password', request.url)
    : new URL('/auth/owner-password?invalid=1', request.url);
  return NextResponse.redirect(destination, 303);
}
